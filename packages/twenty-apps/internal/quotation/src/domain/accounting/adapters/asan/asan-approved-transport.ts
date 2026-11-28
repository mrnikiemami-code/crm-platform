import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity } from 'node:tls';

import { isExactAsanPositiveLong } from 'src/domain/accounting/adapters/asan/asan-customer-finance';
import { ASAN_ENDPOINTS } from 'src/domain/accounting/adapters/asan/asan-endpoints';
import { type AsanFetch } from 'src/domain/accounting/adapters/asan/asan-http-adapter';

// Workspace-scoped, exact destination binding. No ambient DNS, redirects, or proxy
// discovery. The initial rollout supports an explicitly pinned public IPv4 HTTPS
// gateway only; private-network egress requires a separately reviewed server policy.
// The pin is configured by an authorized operator, not supplied by an action body.
export type AsanReadBinding = {
  connectionId: string;
  baseUrl: string;
  ipv4: string;
};

export const isPublicAsanIpv4 = (address: string): boolean => {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) ||
      (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
};

const cleanBase = (raw: string): URL | null => {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' && url.username === '' && url.password === '' &&
      url.search === '' && url.hash === '' && isIP(url.hostname) === 0 &&
      !url.hostname.endsWith('.') && !url.pathname.includes('%')
      ? url : null;
  } catch { return null; }
};

const normalizeBase = (raw: string): string | null => {
  const url = cleanBase(raw);
  return url === null ? null : url.href.replace(/\/+$/, '');
};

export const matchesAsanReadBinding = (binding: AsanReadBinding, connectionId: string, baseUrl: string): boolean => {
  const expected = normalizeBase(binding.baseUrl);
  return binding.connectionId !== '' && binding.connectionId === connectionId &&
    expected !== null && expected === normalizeBase(baseUrl) && isPublicAsanIpv4(binding.ipv4);
};

// This is a read-only rollout gate, not an HTTP-method heuristic: the vendor also
// documents a mutating GET. Every permitted route is enumerated explicitly.
const readRoutes = new Set<string>([
  ASAN_ENDPOINTS.lastProducts, ASAN_ENDPOINTS.allProducts, ASAN_ENDPOINTS.oneProduct,
  ASAN_ENDPOINTS.oneProductWithoutSerial, ASAN_ENDPOINTS.allCustomers,
  ASAN_ENDPOINTS.oneCustomer, ASAN_ENDPOINTS.customerByNationalCode,
  ASAN_ENDPOINTS.customerByMobile, ASAN_ENDPOINTS.allProductPrices,
  ASAN_ENDPOINTS.stores, ASAN_ENDPOINTS.stockProductByStore, ASAN_ENDPOINTS.lastPishFactors,
]);

export const isApprovedAsanRead = (binding: AsanReadBinding, input: string, method: string, body?: string): boolean => {
  const base = cleanBase(binding.baseUrl);
  if (base === null || !['GET', 'POST'].includes(method) || !isPublicAsanIpv4(binding.ipv4)) return false;
  try {
    const url = new URL(input);
    const prefix = base.pathname.replace(/\/+$/, '') + '/';
    const route = url.pathname.slice(prefix.length);
    if (method === 'POST') {
      // Guide p.8: one exact read-only POST, SendPishFactorParameter.
      // Do not allow query overrides, extra keys, duplicate JSON keys, unsafe
      // numeric identities, alternate path, or an arbitrary request body.
      if (url.origin !== base.origin || url.username || url.password || url.hash ||
          !url.pathname.startsWith(prefix) || route !== ASAN_ENDPOINTS.lastCustomerPishFactors ||
          url.search !== '' || typeof body !== 'string' || body.length > 128) return false;
      const value = JSON.parse(body);
      return value !== null && typeof value === 'object' && !Array.isArray(value) &&
        Number.isSafeInteger(value.Count) && value.Count >= 1 && value.Count <= 100 &&
        Number.isSafeInteger(value.CustomerCode) && value.CustomerCode > 0 &&
        body === JSON.stringify({ Count: value.Count, CustomerCode: value.CustomerCode });
    }
    if (body !== undefined) return false;
    // A Cardex read is never an unbounded customer-wide/all-customer query.
    // Its three parameters and the exact <=93-day UTC tick range are mandatory.
    const isBoundedCardex = route === ASAN_ENDPOINTS.customerCardex && (() => {
      const q = url.searchParams;
      const keys = Array.from(q.keys());
      const from = q.get('FromDate');
      const to = q.get('ToDate');
      if (keys.length !== 3 || new Set(keys).size !== 3 ||
          !isExactAsanPositiveLong(q.get('CustomerCode')) ||
          !isExactAsanPositiveLong(from) || !isExactAsanPositiveLong(to)) return false;
      const start = BigInt(from), end = BigInt(to);
      return start >= 621355968000000000n && end >= start &&
        end - start < 93n * 864000000000n && end <= 3155378975999999999n;
    })();
    return url.origin === base.origin && url.username === '' && url.password === '' &&
      url.hash === '' && url.pathname.startsWith(prefix) &&
      (readRoutes.has(route) || isBoundedCardex);
  } catch { return false; }
};

export const createApprovedAsanReadTransport = (binding: AsanReadBinding): AsanFetch =>
  async (input, init) => {
    if (!isApprovedAsanRead(binding, input, init.method, init.body)) {
      throw new Error('Accounting request not allowed by read-only destination policy');
    }
    const url = new URL(input);
    // Connect straight to the operator-approved address, while validating the
    // certificate against the original HTTPS hostname. No TLS bypass or re-resolution.
    return new Promise((resolve, reject) => {
      const request = httpsRequest({
        hostname: binding.ipv4, family: 4, port: url.port === '' ? 443 : Number(url.port),
        servername: url.hostname, checkServerIdentity: (_name, cert) => checkServerIdentity(url.hostname, cert),
        rejectUnauthorized: true, agent: false, method: init.method, path: url.pathname + url.search,
        headers: { ...init.headers, Host: url.host, 'Accept-Encoding': 'identity', ...(init.body === undefined ? {} : { 'Content-Length': String(Buffer.byteLength(init.body, 'utf8')) }) },
        signal: init.signal,
      }, (response) => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.destroy();
          resolve({ ok: false, status, text: async () => '' });
          return;
        }
        // Stream to the adapter's existing bounded reader. It never needs to
        // allocate a complete body before enforcing the ceiling.
        const iterator = response[Symbol.asyncIterator]();
        resolve({
          ok: true, status,
          headers: { get: (name) => {
            const value = response.headers[name.toLowerCase()];
            return typeof value === 'string' ? value : null;
          } },
          body: { getReader: () => ({
            read: async () => {
              const step = await iterator.next();
              return step.done ? { done: true } : { done: false, value: Buffer.from(step.value as Uint8Array) };
            },
            cancel: async () => { response.destroy(); return iterator.return?.(); },
          }) },
          text: async () => { response.destroy(); throw new Error('Use the bounded streaming reader'); },
        });
      });
      request.on('error', reject);
      request.end(init.body);
    });
  };
