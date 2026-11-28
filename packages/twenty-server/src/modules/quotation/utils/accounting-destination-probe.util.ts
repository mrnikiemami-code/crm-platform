import { lookup } from 'node:dns/promises';
import { type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { type IncomingMessage } from 'node:http';

import {
  classifyDestinationHostname,
  classifyIpAddress,
  isDestinationAllowlisted,
  isIpLiteral,
  type AllowlistEntry,
} from 'src/modules/quotation/utils/accounting-destination-policy.util';

// A read-only reachability probe owned by the server.
//
// WHY NOT ACCEPT THE ANSWER FROM THE CALLER: the settings page used to probe in the app and
// post "OK" back. A caller with settings authority could post "OK" without probing, and a
// green indicator would then describe nothing. Here the server resolves, validates and
// calls the documented read endpoint itself, so a stored result is evidence that this
// process reached (or failed to reach) the destination.
//
// The connection is pinned to the address that was validated: DNS is consulted once, the
// answer is checked, and the socket may only go to that answer. A record that resolves
// publicly at check time and privately a second later therefore cannot be rebound.

export type AccountingProbeInput = {
  adapterId: string;
  isLive: boolean;
  healthProbe: { path: string; query?: Record<string, string> } | null;
  baseUrl: string;
  transportApproved: boolean;
  allowlist: readonly AllowlistEntry[];
  timeoutMs?: number;
};

export type AccountingProbeOutcome = {
  healthState: 'OK' | 'FAILED';
  code:
    | 'REACHABLE'
    | 'TRANSPORT_ERROR'
    | 'TIMEOUT'
    | 'INVALID_RESPONSE'
    | 'REDIRECT_REFUSED'
    | 'DESTINATION_NOT_ALLOWED';
  latencyMs: number;
  checkedAt: string;
  detail: string;
};

export type ProbeDependencies = {
  resolveHost?: (
    hostname: string,
  ) => Promise<{ address: string; family: number }[]>;
  request?: (
    url: URL,
    address: string,
    family: number,
    timeoutMs: number,
  ) => Promise<{ status: number; latencyMs: number; body?: string }>;
  now?: () => Date;
};

const DEFAULT_TIMEOUT_MS = 8_000;

const defaultResolveHost = async (
  hostname: string,
): Promise<{ address: string; family: number }[]> => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });

  return addresses.map(({ address, family }) => ({ address, family }));
};

// Node's http client does not follow redirects, which is exactly the behaviour wanted: a
// 3xx is reported as a refusal instead of being silently followed to another host.
export const pinnedHttpGet = (
  url: URL,
  address: string,
  family: number,
  timeoutMs: number,
): Promise<{ status: number; latencyMs: number; body?: string }> =>
  new Promise((resolve, reject) => {
    if (url.protocol !== 'https:') {
      reject(new Error('HTTPS is required'));
      return;
    }
    const startedAt = Date.now();
    const maxBytes = 256 * 1024;
    const handleResponse = (response: IncomingMessage): void => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        resolve({ status, latencyMs: Date.now() - startedAt });
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          reject(new Error('probe response too large'));
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('probe response aborted')));
      response.on('end', () => resolve({
        status, latencyMs: Date.now() - startedAt,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    };
    const options: RequestOptions = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      agent: false,
      family,
      timeout: timeoutMs,
      lookup: ((_hostname: string, _lookupOptions: unknown, callback: (error: Error | null, address: string, family: number) => void) =>
        callback(null, address, family)) as never,
    };
    const request = httpsRequest(url, options, handleResponse);
    const timer = setTimeout(() => {
      const error = new Error('probe timed out');
      error.name = 'TimeoutError';
      request.destroy(error);
    }, timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('timeout', () => {
      const error = new Error('probe timed out');
      error.name = 'TimeoutError';
      request.destroy(error);
    });
    request.on('error', reject);
    request.end();
  });

const buildProbeUrl = (
  baseUrl: string,
  probe: { path: string; query?: Record<string, string> },
): URL | null => {
  const root = baseUrl.trim().replace(/\/+$/, '');
  const path = probe.path.replace(/^\/+/, '');
  const query =
    probe.query === undefined
      ? ''
      : `?${Object.entries(probe.query)
          .map(
            ([key, value]) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          )
          .join('&')}`;

  try {
    return new URL(`${root}/${path}${query}`);
  } catch {
    return null;
  }
};

// LastProducts is a read of the documented Products list, not a generic HTTP ping.
const isAsanProbeBody = (body: string | undefined): boolean => {
  if (body === undefined) return false;
  try {
    const payload: unknown = JSON.parse(body);
    const record = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown> : null;
    const rows = Array.isArray(payload) ? payload :
      record === null ? null : [record.data, record.products, record.Products].find(Array.isArray);
    return Array.isArray(rows) && rows.every((row: unknown) => {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) return false;
      const item = row as Record<string, unknown>;
      const code = typeof item.ProductCode === 'string' && /^\d+$/.test(item.ProductCode.trim())
        ? Number(item.ProductCode) : item.ProductCode;
      return typeof code === 'number' && Number.isSafeInteger(code) && code > 0;
    });
  } catch { return false; }
};

const unreachable = ({
  code,
  detail,
  latencyMs,
  checkedAt,
}: {
  code: AccountingProbeOutcome['code'];
  detail: string;
  latencyMs: number;
  checkedAt: string;
}): AccountingProbeOutcome => ({
  healthState: 'FAILED',
  code,
  detail,
  latencyMs,
  checkedAt,
});

export const probeAccountingDestination = async (
  input: AccountingProbeInput,
  dependencies: ProbeDependencies = {},
): Promise<AccountingProbeOutcome> => {
  const now = dependencies.now ?? (() => new Date());
  const checkedAt = now().toISOString();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // A mock adapter answers in memory: no name, no socket, no secret.
  if (!input.isLive || input.healthProbe === null) {
    return {
      healthState: 'OK',
      code: 'REACHABLE',
      latencyMs: 0,
      checkedAt,
      detail: 'اتصال آزمایشی در حافظه پاسخ داد؛ هیچ درخواستی به شبکه ارسال نشد',
    };
  }

  let base: URL | null = null;
  try { base = new URL(input.baseUrl.trim()); } catch { /* invalid base */ }
  const url = buildProbeUrl(input.baseUrl, input.healthProbe);

  if (url === null || base === null || base.protocol !== 'https:' ||
      base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '') {
    return unreachable({
      code: 'DESTINATION_NOT_ALLOWED',
      detail: 'آدرس مقصد باید HTTPS و بدون اطلاعات ورود یا پارامتر باشد',
      latencyMs: 0,
      checkedAt,
    });
  }

  const hostname = url.hostname;
  const port = url.port === '' ? null : Number.parseInt(url.port, 10);
  const literal = classifyDestinationHostname(hostname);

  if (literal === 'BLOCKED') {
    return unreachable({
      code: 'DESTINATION_NOT_ALLOWED',
      detail: 'مقصد در محدودهٔ نشانی‌های غیرمجاز است و آزمایش انجام نشد',
      latencyMs: 0,
      checkedAt,
    });
  }

  const resolveHost = dependencies.resolveHost ?? defaultResolveHost;
  let addresses: { address: string; family: number }[];

  if (isIpLiteral(hostname)) {
    addresses = [
      {
        address: hostname.replace(/^\[|\]$/g, ''),
        family: hostname.includes(':') ? 6 : 4,
      },
    ];
  } else {
    try {
      addresses = await resolveHost(hostname);
    } catch {
      return unreachable({
        code: 'TRANSPORT_ERROR',
        detail: 'نام مقصد قابل تبدیل به نشانی نبود',
        latencyMs: 0,
        checkedAt,
      });
    }
  }

  if (addresses.length === 0) {
    return unreachable({
      code: 'TRANSPORT_ERROR',
      detail: 'نام مقصد به هیچ نشانی تبدیل نشد',
      latencyMs: 0,
      checkedAt,
    });
  }

  const resolved = addresses.map((entry) => entry.address);

  // Every answer is judged, not just the chosen one: a name that returns one public and
  // one internal address is a rebinding attempt, not a public destination.
  for (const address of resolved) {
    const classification = classifyIpAddress(address);

    if (classification === 'BLOCKED') {
      return unreachable({
        code: 'DESTINATION_NOT_ALLOWED',
        detail: 'مقصد به یک نشانی غیرمجاز تبدیل شد و آزمایش انجام نشد',
        latencyMs: 0,
        checkedAt,
      });
    }

    if (
      classification === 'PRIVATE' &&
      (!input.transportApproved ||
        !isDestinationAllowlisted({
          hostname,
          port,
          addresses: resolved,
          allowlist: input.allowlist,
        }))
    ) {
      return unreachable({
        code: 'DESTINATION_NOT_ALLOWED',
        detail:
          'مقصد در شبکهٔ داخلی است و مجوز دسترسی به آن در فهرست مجاز سرور ثبت نشده است',
        latencyMs: 0,
        checkedAt,
      });
    }
  }

  const request = dependencies.request ?? pinnedHttpGet;
  const startedAt = Date.now();

  try {
    const answer = await request(
      url,
      resolved[0],
      addresses[0].family,
      timeoutMs,
    );

    if (answer.status >= 200 && answer.status < 300) {
      if (input.adapterId === 'asan' && !isAsanProbeBody(answer.body)) {
        return unreachable({
          code: 'INVALID_RESPONSE', detail: 'پاسخ مقصد فهرست معتبر کالا نیست',
          latencyMs: answer.latencyMs, checkedAt,
        });
      }
      return {
        healthState: 'OK',
        code: 'REACHABLE',
        latencyMs: answer.latencyMs,
        checkedAt,
        detail: 'مقصد به خواندن مستند پاسخ داد',
      };
    }

    if (answer.status >= 300 && answer.status < 400) {
      return unreachable({
        code: 'REDIRECT_REFUSED',
        detail: `مقصد به نشانی دیگری هدایت شد (HTTP ${answer.status}) و آزمایش متوقف شد`,
        latencyMs: answer.latencyMs,
        checkedAt,
      });
    }

    return unreachable({
      code: 'INVALID_RESPONSE',
      detail: `پاسخ مقصد نامعتبر بود (HTTP ${answer.status})`,
      latencyMs: answer.latencyMs,
      checkedAt,
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        (error as NodeJS.ErrnoException).code === 'ETIMEDOUT');

    return unreachable({
      code: timedOut ? 'TIMEOUT' : 'TRANSPORT_ERROR',
      detail: timedOut
        ? 'مقصد در زمان مجاز پاسخ نداد'
        : 'ارتباط با مقصد برقرار نشد',
      latencyMs,
      checkedAt,
    });
  }
};
