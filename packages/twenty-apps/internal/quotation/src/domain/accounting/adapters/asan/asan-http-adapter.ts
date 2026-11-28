import { createHash } from 'node:crypto';

import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { ASAN_ENDPOINTS, buildAsanUrl } from 'src/domain/accounting/adapters/asan/asan-endpoints';
import {
  mapItemPricesToAsanUpdate,
  mapItemToAsanProduct,
} from 'src/domain/accounting/adapters/asan/asan-product';
import {
  mapPartyToAsanCustomer,
  type AsanCustomerInput,
} from 'src/domain/accounting/adapters/asan/asan-customer';
import {
  classifyAsanResponse,
  type AsanOperation,
} from 'src/domain/accounting/adapters/asan/asan-response';
import {
  ACCOUNTING_ADAPTER_CONTRACT_VERSION,
  type AccountingAdapter,
  type AdapterHealth,
  type RemoteCatalogItem,
  type RemoteCatalogObservation,
  type RemotePriceObservation,
  type RemoteStorage,
  type RemoteDocument,
  type RemoteItemInput,
  type RemoteParty,
  type RemotePartyInput,
  type RemoteProformaInput,
} from 'src/domain/accounting/adapter-contract';
import { normalizeIranMobile, normalizePartyName, partyNationalIdentity } from 'src/domain/accounting/party-identity';
import { accepted, refused, type Result } from 'src/domain/shared/result';

export type AsanFetchResponse = {
  ok: boolean;
  status: number;
  headers?: { get: (name: string) => string | null } | null;
  body?: {
    getReader: () => {
      read: () => Promise<{ done: boolean; value?: Uint8Array }>;
      cancel: () => Promise<unknown>;
    };
  } | null;
  text: () => Promise<string>;
};

export type AsanFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    redirect?: 'error';
  },
) => Promise<AsanFetchResponse>;

export type AsanHttpAdapterConfig = {
  baseUrl: string;
  remoteUserId: string;
  // A bearer token for an approved tunnel/proxy in front of Asan. Asan itself documents no
  // authentication, so this is never required and never sent to a plain address.
  tunnelToken?: string;
  // Legacy configuration retained for compatibility. It cannot authorize cleartext.
  // A real tunnel must expose an HTTPS endpoint to this adapter.
  allowInsecureTransport?: boolean;
  timeoutMs?: number;
  fetchImpl?: AsanFetch;
  now?: () => Date;
};

const DEFAULT_TIMEOUT_MS = 15_000;

// Asan answers `AllProducts`/`AllCustomers` with the whole list in one body, so a large
// installation produces a large body. This ceiling is checked BEFORE the JSON is parsed:
// parsing first and counting afterwards would allocate exactly the memory the ceiling exists
// to protect. A workspace above it gets an explicit refusal instead of a process that grows
// with the vendor's table.
const DEFAULT_LIST_BODY_MAX_BYTES = 64 * 1024 * 1024;

const readListBodyMaxBytes = (): number => {
  const parsed = Number.parseInt(
    String(process.env.ACCOUNTING_REMOTE_RESPONSE_MAX_BYTES ?? ''),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LIST_BODY_MAX_BYTES;
};

// The ceiling has to be enforced while the bytes arrive, not after they are all in a string:
// `response.text()` already allocates the whole body, so checking `.length` afterwards is a
// measurement of the damage, not a guard against it. This reads the stream chunk by chunk,
// counts real UTF-8 bytes, and aborts the reader the moment the budget is crossed. When the
// runtime hands us no stream we still check the buffered text, and the caller is told which
// path ran so nothing here is called "streaming" unless it streamed.
export const readBoundedResponseText = async (
  response: AsanFetchResponse,
  maxBytes: number,
): Promise<Result<string>> => {
  const declared = Number.parseInt(
    String(response.headers?.get('content-length') ?? ''),
    10,
  );

  if (Number.isFinite(declared) && declared > maxBytes) {
    return refused(
      'REMOTE_DATASET_TOO_LARGE',
      `the vendor declared ${declared} bytes, above the ${maxBytes} byte ceiling; the body was not read`,
    );
  }

  const body = response.body;

  if (body !== undefined && body !== null && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
      for (;;) {
        const step = await reader.read();

        if (step.done) {
          break;
        }

        if (step.value === undefined) {
          continue;
        }

        total += step.value.byteLength;

        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);

          return refused(
            'REMOTE_DATASET_TOO_LARGE',
            `the vendor streamed more than ${maxBytes} bytes; the read was aborted after ${total} bytes`,
          );
        }

        chunks.push(step.value);
      }
    } catch {
      await reader.cancel().catch(() => undefined);

      return refused('INVALID_RESPONSE', 'the response body could not be read');
    }

    const buffer = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return accepted(new TextDecoder('utf-8').decode(buffer));
  }

  let text: string;

  try {
    text = await response.text();
  } catch {
    return refused('INVALID_RESPONSE', 'the response body could not be read');
  }

  const bufferedBytes = new TextEncoder().encode(text).byteLength;

  if (bufferedBytes > maxBytes) {
    return refused(
      'REMOTE_DATASET_TOO_LARGE',
      `the vendor answered ${bufferedBytes} bytes, above the ${maxBytes} byte ceiling (the runtime exposed no stream, so the body was already buffered)`,
    );
  }

  return accepted(text);
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
};

// The guide shows payloads as arrays, but not every build wraps them the same way. Accepting
// the documented array plus the two plausible envelopes is how the adapter survives a build
// difference without inventing data: anything else is an unreadable response, not an empty
// catalog.
const extractArray = (
  payload: unknown,
  envelopeKeys: readonly string[],
): unknown[] | null => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);

  if (record === null) {
    return null;
  }

  for (const key of envelopeKeys) {
    const candidate = record[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
};

// Asan documents no etag or version on products and customers, so the change marker is a
// hash of the record the vendor returned. That is enough to notice "this moved since we
// read it" without pretending the vendor gave us something it did not.
const canonicalRecord = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalRecord);
  const record = asRecord(value);
  return record === null
    ? value
    : Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalRecord(record[key])]));
};

const hashRecord = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(canonicalRecord(value)), 'utf8').digest('hex');

// Unsafe JSON numbers cannot be recovered. Refuse them rather than rounding an
// accounting price; exact long values supplied as strings remain exact.
const exactLong = (value: unknown, allowZero = false): string | null => {
  const text = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^(0|[1-9]\d*)$/.test(text) || text.length > 19) return null;
  const n = BigInt(text);
  return n <= 9223372036854775807n && (allowZero || n > 0n) ? text : null;
};

const exactLongArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const element of value) {
    const exact = exactLong(element, true);
    if (exact === null) return null;
    result.push(exact);
  }
  return result;
};

const finiteArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null;
  const result: number[] = [];
  for (const element of value) {
    const parsed = readNumber(element);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
};

const parseCatalogObservation = (record: Record<string, unknown>): RemoteCatalogObservation | null => {
  const observation: RemoteCatalogObservation = { version: '1' };
  if (record.SalesPrice10 !== undefined && record.SalesPrice10 !== null) {
    const prices = exactLongArray(record.SalesPrice10);
    if (prices === null) return null;
    observation.priceUnitsByPosition = prices;
  }
  if (record.StoreProduct !== undefined && record.StoreProduct !== null) {
    const stock = finiteArray(record.StoreProduct);
    if (stock === null) return null;
    observation.stockByPosition = stock;
  }
  if (record.ProductUnitID !== undefined && record.ProductUnitID !== null) {
    const id = exactLong(record.ProductUnitID, true);
    if (id === null || BigInt(id) > 2147483647n) return null;
    observation.unitId = id;
  }
  for (const [wire, key] of [
    ['ProductUnitTitle', 'unitName'], ['SecondUnitTitle', 'secondaryUnitName'], ['TaxID', 'taxCode'],
  ] as const) {
    const value = record[wire];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') return null;
      observation[key] = value;
    }
  }
  if (record.ProductUnitCount !== undefined && record.ProductUnitCount !== null) {
    const count = readNumber(record.ProductUnitCount);
    if (count === null) return null;
    observation.unitCount = count;
  }
  return observation;
};

const parseProduct = (raw: unknown): RemoteCatalogItem | null => {
  const record = asRecord(raw);

  if (record === null) {
    return null;
  }

  const code = readNumber(record.ProductCode);
  const observation = parseCatalogObservation(record);

  if (code === null || !Number.isSafeInteger(code) || code <= 0 || observation === null) {
    return null;
  }

  const salesPrices: number[] = [];
  if (record.SalesPrice !== undefined && record.SalesPrice !== null) {
    if (!Array.isArray(record.SalesPrice)) return null;
    for (const value of record.SalesPrice) {
      const price = readNumber(value);
      if (price === null || !Number.isInteger(price) || price < 0 || price > 4294967295) return null;
      salesPrices.push(price);
    }
  }

  return {
    externalItemId: String(code),
    code: String(code),
    name: readString(record.ProductName),
    secondaryName: readString(record.ProductName2) || null,
    sellPriceUnits: readNumber(record.SellPrice),
    salesPriceUnits: salesPrices,
    ...(Object.keys(observation).length > 1 ? { observation } : {}),
    // Products.TotalCount is the documented aggregate stock (p.26).
    stock: readNumber(record.TotalCount) ?? (record.TotalCount === undefined ? readNumber(record.Stock) ?? readNumber(record.Quantity) : null),
    remoteVersion: hashRecord(record),
    isActive: true,
  };
};

export const parseParty = (raw: unknown): RemoteParty | null => {
  const record = asRecord(raw);

  if (record === null) {
    return null;
  }

  // CustomerServiceViewModel (guide p.29) is NOT CustomerViewModel
  // (write input p.24). Prefer the documented read schema; compatibility
  // aliases are only used when the read field is absent. A conflicting code
  // cannot identify a CRM customer safely.
  const codeOf = (value: unknown): string =>
    typeof value === 'string' ? value.trim() :
      typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : '';
  const code = codeOf(record.Code === undefined ? record.PersonCode : record.Code);
  if (!/^\d+$/.test(code) || /^0+$/.test(code)) return null;
  if (record.Code !== undefined && record.PersonCode !== undefined && codeOf(record.PersonCode) !== code) return null;
  const field = (read: string, legacy: string): string | null =>
    readString(record[read] === undefined ? record[legacy] : record[read]) || null;
  const national = field('NationalCode', 'PersonNationalCode');
  const settlementDays = readNumber(record.SettlementDays);
  return {
    externalPartyId: code, code,
    fullName: field('FullName', 'PersonFullName') ?? '',
    mobile: field('Mobile', 'PersonMobile'),
    nationalCode: national,
    ...(national !== null && /^\d{11}$/.test(national) ? { legalNationalId: national } : {}),
    economicCode: field('EconomicCode', 'PersonEcoCode'),
    address: field('Address', 'PersonAddress'),
    firstPhone: field('Tellephone', 'PersonFirstTell'),
    secondPhone: field('Tellephone2', 'PersonSecoundTell'),
    fax: field('Fax', 'PersonFax'),
    postalCode: field('PostalCode', 'PersonPostalCode'),
    accountGroup: field('AccountGroup', 'PersonAccountGroup'),
    ...(settlementDays !== null && Number.isInteger(settlementDays) && settlementDays >= 0 && settlementDays <= 255 ? { settlementDays } : {}),
    // PersonGender describes account nature, not legal person type.
    remoteVersion: 'party-v2:' + hashRecord(record),
  };
};

type RawResponse = {
  status: number;
  text: string;
  latencyMs: number;
};

export class AsanHttpAdapter implements AccountingAdapter {
  readonly id = 'asan' as const;
  readonly contractVersion = ACCOUNTING_ADAPTER_CONTRACT_VERSION;
  readonly capabilities = ASAN_CAPABILITIES;
  readonly isLive = true;

  private readonly config: AsanHttpAdapterConfig;
  private readonly fetchImpl: AsanFetch | undefined;
  private readonly now: () => Date;

  constructor(config: AsanHttpAdapterConfig) {
    this.config = config;
    // No ambient fetch fallback: until the approved, destination-bound transport
    // is wired, a configured URL must not become a credential-bearing network call.
    this.fetchImpl = config.fetchImpl;
    this.now = config.now ?? (() => new Date());
  }

  private transportIsSecure(): boolean {
    try {
      const url = new URL(this.config.baseUrl.trim());
      return url.protocol === 'https:' && url.hostname !== '' &&
        url.username === '' && url.password === '' && url.search === '' && url.hash === '';
    } catch {
      return false;
    }
  }

  // The legacy approval flag is not proof of encryption. Customer reads also carry
  // personal information, so every actual request must use a clean HTTPS base URL.
  private checkWriteTransport(): Result<true> {
    return this.transportIsSecure()
      ? accepted(true)
      : refused('TRANSPORT_NOT_APPROVED', 'an HTTPS vendor endpoint or HTTPS tunnel is required');
  }

  private async request({
    path,
    method,
    query,
    body,
  }: {
    path: string;
    method: 'GET' | 'POST';
    query?: Record<string, string>;
    body?: unknown;
  }): Promise<Result<RawResponse>> {
    const transport = this.checkWriteTransport();
    if (!transport.ok) return transport;
    const fetchImpl = this.fetchImpl;
    if (fetchImpl === undefined) return refused(
      'ASAN_TRANSPORT_UNAVAILABLE', 'the approved accounting transport has not been wired',
    );

    const headers: Record<string, string> = { Accept: 'application/json' };
    const startedAt = Date.now();

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.config.tunnelToken !== undefined && this.config.tunnelToken !== '') {
      headers.Authorization = `Bearer ${this.config.tunnelToken}`;
    }

    let response: Awaited<ReturnType<AsanFetch>>;

    try {
      response = await fetchImpl(
        buildAsanUrl({
          baseUrl: this.config.baseUrl,
          path,
          query,
        }),
        {
          method,
          headers,
          redirect: 'error',
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(
            this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          ),
        },
      );
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');

      return refused(
        timedOut ? 'TIMEOUT' : 'TRANSPORT_ERROR',
        timedOut
          ? 'the vendor did not answer within the allowed time'
          : 'the vendor address could not be reached',
      );
    }

    const bounded = await readBoundedResponseText(
      response,
      readListBodyMaxBytes(),
    );

    if (!bounded.ok) {
      return bounded;
    }

    return accepted({
      status: response.status,
      text: bounded.value,
      latencyMs: Date.now() - startedAt,
    });
  }

  private parseJson(text: string): Result<unknown> {
    if (text.trim() === '') {
      return accepted(null);
    }

    try {
      return accepted(JSON.parse(text) as unknown);
    } catch {
      return refused('INVALID_RESPONSE', 'the response was not JSON');
    }
  }

  // Asan answers writes with a bare integer, which proxies and older gateways sometimes
  // quote. Anything else is UNEXPECTED rather than an assumed success.
  private parseWriteCode(text: string): number {
    const parsed = this.parseJson(text);

    if (!parsed.ok) {
      return Number.NaN;
    }

    if (typeof parsed.value === 'number') {
      return parsed.value;
    }

    if (typeof parsed.value === 'string') {
      return /^-?\d+$/.test(parsed.value.trim()) ? Number(parsed.value) : Number.NaN;
    }

    const record = asRecord(parsed.value);

    if (record !== null) {
      return (
        readNumber(record.result) ??
        readNumber(record.Result) ??
        readNumber(record.code) ??
        Number.NaN
      );
    }

    return Number.NaN;
  }

  private classifyWrite(
    operation: AsanOperation,
    text: string,
  ): ReturnType<typeof classifyAsanResponse> {
    return classifyAsanResponse({
      operation,
      rawCode: this.parseWriteCode(text),
    });
  }

  async testConnection(): Promise<Result<AdapterHealth>> {
    const result = await this.request({
      path: ASAN_ENDPOINTS.lastProducts,
      method: 'GET',
      query: { Count: '1' },
    });
    const checkedAt = this.now().toISOString();

    if (!result.ok) {
      return accepted({
        kind: 'UNREACHABLE',
        checkedAt,
        latencyMs: 0,
        transportIsSecure: this.transportIsSecure(),
        code:
          result.refusal.code === 'TIMEOUT'
            ? 'TIMEOUT'
            : result.refusal.code === 'INVALID_RESPONSE'
              ? 'INVALID_RESPONSE'
              : 'TRANSPORT_ERROR',
        detail: result.refusal.detail,
      });
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return accepted({
        kind: 'UNREACHABLE',
        checkedAt,
        latencyMs: result.value.latencyMs,
        transportIsSecure: this.transportIsSecure(),
        code: 'INVALID_RESPONSE',
        detail: `the vendor answered HTTP ${result.value.status} for the documented read`,
      });
    }

    const parsed = this.parseJson(result.value.text);
    const records = parsed.ok ? extractArray(parsed.value, ['data', 'products', 'Products']) : null;
    if (records === null || records.some((record) => parseProduct(record) === null)) {
      return accepted({
        kind: 'UNREACHABLE',
        checkedAt,
        latencyMs: result.value.latencyMs,
        transportIsSecure: this.transportIsSecure(),
        code: 'INVALID_RESPONSE',
        detail: 'the vendor did not return the expected Products list',
      });
    }

    return accepted({
      kind: 'REACHABLE',
      checkedAt,
      latencyMs: result.value.latencyMs,
      transportIsSecure: this.transportIsSecure(),
      detail: 'the vendor answered the documented read over TLS',
    });
  }

  async listItems(): Promise<Result<RemoteCatalogItem[]>> {
    const result = await this.request({
      path: ASAN_ENDPOINTS.allProducts,
      method: 'GET',
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'INVALID_RESPONSE',
        `the vendor answered HTTP ${result.value.status} for the product list`,
      );
    }

    const parsed = this.parseJson(result.value.text);

    if (!parsed.ok) {
      return parsed;
    }

    const records = extractArray(parsed.value, ['data', 'products', 'Products']);

    if (records === null) {
      return refused(
        'INVALID_RESPONSE',
        'the product list was not an array',
      );
    }

    const items: RemoteCatalogItem[] = [];
    for (const record of records) {
      const item = parseProduct(record);
      if (item === null) return refused('ASAN_INCOMPLETE_DATASET', 'product list contains a row with an unusable identity');
      items.push(item);
    }
    // Duplicate codes are intentionally retained for the mapping planner to flag.
    return accepted(items);
  }

  async listParties(): Promise<Result<RemoteParty[]>> {
    const result = await this.request({
      path: ASAN_ENDPOINTS.allCustomers,
      method: 'GET',
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'INVALID_RESPONSE',
        `the vendor answered HTTP ${result.value.status} for the customer list`,
      );
    }

    const parsed = this.parseJson(result.value.text);

    if (!parsed.ok) {
      return parsed;
    }

    const records = extractArray(parsed.value, [
      'data',
      'customers',
      'Customers',
    ]);

    if (records === null) {
      return refused('INVALID_RESPONSE', 'the customer list was not an array');
    }

    const parties: RemoteParty[] = [];
    for (const record of records) {
      const party = parseParty(record);
      if (party === null) return refused('ASAN_INCOMPLETE_DATASET', 'customer list contains a row with an unusable identity');
      parties.push(party);
    }
    return accepted(parties);
  }

  async readItem(externalItemId: string): Promise<Result<RemoteCatalogItem>> {
    const code = exactLong(externalItemId);
    if (code === null || !Number.isSafeInteger(Number(code))) {
      return refused('ASAN_READBACK_REQUIRED', 'product identity is outside the supported safe range');
    }
    return this.readProductByCode(Number(code));
  }

  async readPartiesByMobile(mobile: string): Promise<Result<RemoteParty[]>> {
    const normalized = normalizeIranMobile(mobile);
    if (normalized === null) return refused('ASAN_CUSTOMER_LOOKUP_REQUIRED', 'a valid mobile is required');
    const rows = await this.readPartyRecords(ASAN_ENDPOINTS.customerByMobile, { Mobile: mobile.trim() });
    if (!rows.ok) return rows;
    const parties: RemoteParty[] = [];
    const seen = new Set<string>();
    for (const row of rows.value) {
      const party = parseParty(row);
      if (party === null || normalizeIranMobile(party.mobile) !== normalized || seen.has(party.externalPartyId)) {
        return refused('ASAN_INCOMPLETE_DATASET', 'mobile lookup returned an unrelated or duplicate identity');
      }
      seen.add(party.externalPartyId);
      parties.push(party);
    }
    return accepted(parties);
  }

  private async readList(path: string, envelopes: readonly string[]): Promise<Result<unknown[]>> {
    const response = await this.request({ path, method: 'GET' });
    if (!response.ok) return response;
    if (response.value.status < 200 || response.value.status >= 300) {
      return refused('INVALID_RESPONSE', 'the documented read did not succeed');
    }
    const parsed = this.parseJson(response.value.text);
    if (!parsed.ok) return parsed;
    const rows = extractArray(parsed.value, envelopes);
    return rows === null ? refused('INVALID_RESPONSE', 'the documented read did not return a list') : accepted(rows);
  }

  async listPrices(): Promise<Result<RemotePriceObservation[]>> {
    const rows = await this.readList(ASAN_ENDPOINTS.allProductPrices, ['data', 'prices', 'Prices']);
    if (!rows.ok) return rows;
    const prices: RemotePriceObservation[] = [];
    const seen = new Set<string>();
    for (const row of rows.value) {
      const record = asRecord(row);
      const id = exactLong(record?.ProductCode);
      const parent = exactLong(record?.parent, true);
      const tiers = exactLongArray(record?.PriceList);
      const stock = finiteArray(record?.StoreProduct);
      if (record === null || id === null || seen.has(id) || typeof record.ProductName !== 'string' ||
          parent === null || tiers === null || stock === null) {
        return refused('ASAN_INCOMPLETE_DATASET', 'price list has an incomplete or duplicate row');
      }
      seen.add(id);
      prices.push({ externalItemId: id, name: record.ProductName, parentId: parent === '0' ? null : parent,
        priceUnitsByPosition: tiers, stockByPosition: stock });
    }
    return accepted(prices);
  }

  async listStores(): Promise<Result<RemoteStorage[]>> {
    const rows = await this.readList(ASAN_ENDPOINTS.stores, ['data', 'stores', 'Stores']);
    if (!rows.ok) return rows;
    const stores: RemoteStorage[] = [];
    const seen = new Set<string>();
    for (const row of rows.value) {
      const record = asRecord(row);
      const id = exactLong(record?.StoreID);
      if (record === null || id === null || BigInt(id) > 4294967295n ||
          typeof record.StoreName !== 'string' || record.StoreName.trim() === '' || seen.has(id)) {
        return refused('ASAN_INCOMPLETE_DATASET', 'store list has an incomplete or duplicate row');
      }
      seen.add(id);
      stores.push({ externalStorageId: id, name: record.StoreName });
    }
    return accepted(stores);
  }

  async readStockByStore(externalItemId: string, externalStorageId: string): Promise<Result<number>> {
    const product = exactLong(externalItemId);
    const store = exactLong(externalStorageId);
    if (product === null || store === null || BigInt(product) > 2147483647n || BigInt(store) > 2147483647n) {
      return refused('INVALID_RESPONSE', 'stock read requires valid int product and store identities');
    }
    const response = await this.request({ path: ASAN_ENDPOINTS.stockProductByStore, method: 'GET',
      query: { ProductCode: product, StoreID: store } });
    if (!response.ok) return response;
    if (response.value.status < 200 || response.value.status >= 300) return refused('INVALID_RESPONSE', 'stock read did not succeed');
    const parsed = this.parseJson(response.value.text);
    if (!parsed.ok) return parsed;
    const count = readNumber(parsed.value);
    return count === null ? refused('INVALID_RESPONSE', 'stock response was not a finite number') : accepted(count);
  }

  // OneProductWithoutSerial is the documented single product read (p.15).
  private async readProductByCode(code: number): Promise<Result<RemoteCatalogItem>> {
    const result = await this.request({ path: ASAN_ENDPOINTS.oneProductWithoutSerial, method: 'GET', query: { ProductCode: String(code) } });
    if (!result.ok) return result;
    if (result.value.status < 200 || result.value.status >= 300) return refused('ASAN_READBACK_REQUIRED', 'product read did not return a successful HTTP response');
    const parsed = this.parseJson(result.value.text);
    if (!parsed.ok) return parsed;
    const item = parseProduct(parsed.value);
    return item !== null && item.externalItemId === String(code)
      ? accepted(item) : refused('ASAN_READBACK_REQUIRED', 'product read did not return the requested identity');
  }

  private async confirmProductWrite(body: string, code: number, price: number, tiers: number[]): Promise<Result<RemoteCatalogItem>> {
    const response = this.parseWriteCode(body);
    if (!Number.isInteger(response) || response <= 0 || response > 2147483647) return refused('ASAN_WRITE_UNCONFIRMED', 'product write did not return a positive integer; reconcile before retry');
    const observed = await this.readProductByCode(code);
    if (!observed.ok || observed.value.sellPriceUnits !== price ||
      tiers.some((tier, index) => observed.value.salesPriceUnits[index] !== tier)) {
      return refused('ASAN_WRITE_UNCONFIRMED', 'product write could not be confirmed by exact price readback; reconcile before retry');
    }
    return observed;
  }

  async createItem(input: RemoteItemInput): Promise<Result<RemoteCatalogItem>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const mapped = mapItemToAsanProduct({
      productCode: Number(input.externalItemId ?? input.code),
      name: input.name,
      secondaryName: input.secondaryName,
      sellPrice: input.sellPriceUnits,
      salesPrices: input.salesPriceUnits,
    });

    if (!mapped.ok) {
      return mapped;
    }

    const result = await this.request({
      path: ASAN_ENDPOINTS.addProduct,
      method: 'POST',
      body: mapped.value,
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'VENDOR_REFUSED',
        `the vendor answered HTTP ${result.value.status} for the product create`,
      );
    }

    const verified = await this.confirmProductWrite(result.value.text, mapped.value.ProductCode, mapped.value.SellPrice, mapped.value.SalesPrice ?? []);
    if (!verified.ok) return verified;
    return verified.value.name === mapped.value.ProductName
      ? verified : refused('ASAN_WRITE_UNCONFIRMED', 'product identity/name readback differs; reconcile before retry');
  }

  async updateItemPrices(
    input: RemoteItemInput,
  ): Promise<Result<RemoteCatalogItem>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const productCode = Number(input.externalItemId ?? input.code);
    if (!Number.isSafeInteger(productCode) || productCode <= 0 || input.salesPriceUnits.length > 2) return refused('ASAN_PRICE_RANGE_INVALID', 'invalid product code or price tiers');
    const current = await this.readProductByCode(productCode);
    if (!current.ok) return current;
    const tiers = [input.salesPriceUnits[0] ?? current.value.salesPriceUnits[0], input.salesPriceUnits[1] ?? current.value.salesPriceUnits[1]];
    if (tiers.some((tier) => tier === undefined)) return refused('ASAN_PRICE_TIERS_REQUIRED', 'readback did not establish both price tiers');
    const mapped = mapItemPricesToAsanUpdate({
      productCode,
      currentName: current.value.name,
      currentSecondaryName: current.value.secondaryName,
      sellPrice: input.sellPriceUnits,
      salesPrices: tiers as number[],
    });

    if (!mapped.ok) {
      return mapped;
    }

    const result = await this.request({
      path: ASAN_ENDPOINTS.editProduct,
      method: 'POST',
      body: mapped.value,
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'VENDOR_REFUSED',
        `the vendor answered HTTP ${result.value.status} for the price update`,
      );
    }

    const verified = await this.confirmProductWrite(result.value.text, mapped.value.ProductCode, mapped.value.SellPrice, mapped.value.SalesPrice ?? []);
    if (!verified.ok) return verified;
    return verified.value.name === current.value.name && verified.value.secondaryName === current.value.secondaryName
      ? verified : refused('ASAN_WRITE_UNCONFIRMED', 'product name changed during price update; reconcile before retry');
  }

  private async readPartyRecords(path: string, query: Record<string, string>): Promise<Result<Record<string, unknown>[]>> {
    const result = await this.request({ path, method: 'GET', query });
    if (!result.ok) return result;
    if (result.value.status < 200 || result.value.status >= 300) return refused('ASAN_READBACK_REQUIRED', 'customer read was unsuccessful');
    const parsed = this.parseJson(result.value.text);
    if (!parsed.ok) return parsed;
    const rows = extractArray(parsed.value, ['data', 'customers', 'Customers']);
    if (rows === null) return refused('INVALID_RESPONSE', 'customer read did not return the documented list');
    const records: Record<string, unknown>[] = [];
    for (const row of rows) {
      const record = asRecord(row);
      if (record === null || parseParty(record) === null) return refused('ASAN_INCOMPLETE_DATASET', 'customer read includes an unusable identity');
      records.push(record);
    }
    return accepted(records);
  }

  private async lookupPartyForCreate(input: RemotePartyInput): Promise<Result<RemoteParty[]>> {
    const national = partyNationalIdentity(input);
    const mobile = normalizeIranMobile(input.mobile);
    if (national === null && mobile === null) return refused('ASAN_CUSTOMER_LOOKUP_REQUIRED', 'a valid national identifier or mobile is required to reconcile a generated customer code');
    const records = national !== null
      ? await this.readPartyRecords(ASAN_ENDPOINTS.customerByNationalCode, { NationalCode: national })
      : await this.readPartyRecords(ASAN_ENDPOINTS.customerByMobile, { Mobile: input.mobile?.trim() ?? '' });
    if (!records.ok) return records;
    const parties = records.value.map(parseParty).filter((party): party is RemoteParty => party !== null);
    if (parties.some((party) => national !== null ? partyNationalIdentity(party) !== national : normalizeIranMobile(party.mobile) !== mobile)) return refused('ASAN_READBACK_REQUIRED', 'customer lookup returned unrelated records');
    return accepted(parties);
  }

  async createParty(input: RemotePartyInput): Promise<Result<RemoteParty>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const mapped = mapPartyToAsanCustomer(
      {
        personCode: null,
        fullName: input.fullName,
        mobile: input.mobile,
        nationalCode: input.legalNationalId ?? input.nationalCode,
        address: input.address,
        economicCode: input.economicCode ?? null,
        postalCode: input.postalCode ?? null,
        firstPhone: input.firstPhone ?? null,
        secondPhone: input.secondPhone ?? null,
        fax: input.fax ?? null,
        accountGroup: input.accountGroup ?? null,
        userId: Number(this.config.remoteUserId || '0'),
      },
      { isUpdate: false },
    );

    if (!mapped.ok) {
      return mapped;
    }

    const before = await this.lookupPartyForCreate(input);
    if (!before.ok) return before;
    if (before.value.length !== 0) return refused('ASAN_CUSTOMER_ALREADY_EXISTS', 'customer lookup is not empty; link or review before creating');
    const result = await this.request({
      path: ASAN_ENDPOINTS.addCustomer,
      method: 'POST',
      body: mapped.value,
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'VENDOR_REFUSED',
        `the vendor answered HTTP ${result.value.status} for the customer create`,
      );
    }

    const classification = this.classifyWrite(
      'CREATE_CUSTOMER',
      result.value.text,
    );

    if (classification.kind === 'FAILED') {
      return refused(
        `ASAN_${classification.reason}`,
        `the vendor refused the customer write (code ${classification.code})`,
      );
    }

    if (classification.kind === 'UNEXPECTED') {
      return refused('VENDOR_UNDOCUMENTED', classification.detail);
    }

    const assigned = await this.lookupPartyForCreate(input);
    if (!assigned.ok || assigned.value.length !== 1 ||
      normalizePartyName(assigned.value[0].fullName) !== normalizePartyName(input.fullName)) {
      return refused('ASAN_WRITE_UNCONFIRMED', 'customer creation cannot be uniquely reconciled; do not retry automatically');
    }
    return accepted(assigned.value[0]);
  }

  async updateParty(input: RemotePartyInput): Promise<Result<RemoteParty>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const personCode = Number(input.externalPartyId ?? '');
    if (!Number.isInteger(personCode) || personCode <= 0 || personCode > 2147483647) return refused('ASAN_UPDATE_NEEDS_PERSON_CODE', 'customer update requires a valid int code');
    const current = await this.readPartyRecords(ASAN_ENDPOINTS.oneCustomer, { CustomerCode: String(personCode) });
    if (!current.ok) return current;
    if (current.value.length !== 1 || parseParty(current.value[0])?.externalPartyId !== String(personCode)) return refused('ASAN_READBACK_REQUIRED', 'customer lookup did not establish a unique matching code');
    const raw = current.value[0];
    const gender = readNumber(raw.Gender);
    if (gender === null || !Number.isInteger(gender) || gender < 0 || gender > 255) return refused('ASAN_CUSTOMER_PROFILE_INCOMPLETE', 'current account nature is unavailable');

    const mapped = mapPartyToAsanCustomer(
      {
        personCode,
        personGender: gender,
        fullName: input.fullName,
        mobile: input.mobile,
        nationalCode: input.legalNationalId ?? input.nationalCode,
        address: input.address,
        economicCode: input.economicCode ?? null,
        postalCode: input.postalCode ?? null,
        firstPhone: input.firstPhone ?? null,
        secondPhone: input.secondPhone ?? null,
        fax: input.fax ?? null,
        accountGroup: input.accountGroup ?? null,
        userId: Number(this.config.remoteUserId || '0'),
      },
      { isUpdate: true },
    );

    if (!mapped.ok) {
      return mapped;
    }

    // The vendor's update replaces the record. Require every documented
    // writable string in the current read, including explicit blank values.
    const fields = {
      PersonMobile: 'Mobile', PersonNationalCode: 'NationalCode',
      PersonAddress: 'Address', PersonEcoCode: 'EconomicCode',
      PersonPostalCode: 'PostalCode', PersonFirstTell: 'Tellephone',
      PersonSecoundTell: 'Tellephone2', PersonFax: 'Fax',
      PersonAccountGroup: 'AccountGroup',
    } as const;
    const payload: AsanCustomerInput = { ...mapped.value };
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      const original = raw[fields[key]];
      if (typeof original !== 'string') return refused('ASAN_CUSTOMER_PROFILE_INCOMPLETE', 'current customer profile lacks a replaceable field');
      payload[key] = payload[key] ?? original;
    }
    const result = await this.request({
      path: ASAN_ENDPOINTS.editCustomer,
      method: 'POST',
      body: payload,
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'VENDOR_REFUSED',
        `the vendor answered HTTP ${result.value.status} for the customer update`,
      );
    }

    const classification = this.classifyWrite(
      'UPDATE_CUSTOMER',
      result.value.text,
    );

    if (classification.kind === 'FAILED') {
      return refused(
        `ASAN_${classification.reason}`,
        `the vendor refused the customer update (code ${classification.code})`,
      );
    }

    if (classification.kind === 'UNEXPECTED') {
      return refused('VENDOR_UNDOCUMENTED', classification.detail);
    }

    const after = await this.readPartyRecords(ASAN_ENDPOINTS.oneCustomer, { CustomerCode: String(personCode) });
    if (!after.ok || after.value.length !== 1) return refused('ASAN_WRITE_UNCONFIRMED', 'customer update readback failed; reconcile before retry');
    const observed = after.value[0];
    const party = parseParty(observed);
    if (party === null || party.externalPartyId !== String(personCode) ||
        party.fullName !== payload.PersonFullName || readNumber(observed.Gender) !== payload.PersonGender ||
        (Object.keys(fields) as (keyof typeof fields)[]).some((key) => observed[fields[key]] !== payload[key])) {
      return refused('ASAN_WRITE_UNCONFIRMED', 'customer readback differs from replacement payload; reconcile before retry');
    }
    return accepted(party);
  }

  async registerProforma(
    input: RemoteProformaInput,
  ): Promise<Result<RemoteDocument>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const result = await this.request({
      path: ASAN_ENDPOINTS.registerProforma,
      method: 'POST',
      body: input.payload,
    });

    if (!result.ok) {
      return result;
    }

    if (result.value.status < 200 || result.value.status >= 300) {
      return refused(
        'VENDOR_REFUSED',
        `the vendor answered HTTP ${result.value.status} for the pro-forma registration`,
      );
    }

    const classification = this.classifyWrite(
      'REGISTER_PROFORMA',
      result.value.text,
    );

    if (classification.kind === 'DOCUMENT_REGISTERED') {
      return accepted({
        externalDocumentId: String(classification.documentNumber),
        documentNumber: String(classification.documentNumber),
        registeredAt: this.now().toISOString(),
      });
    }

    if (classification.kind === 'FAILED') {
      return refused(
        `ASAN_${classification.reason}`,
        `the vendor did not register the document (code ${classification.code}); a retry needs reconciliation because 0 is also the answer for an unspecified failure`,
      );
    }

    // SUCCEEDED_WITHOUT_IDENTIFIER is correct for a customer write and impossible for a
    // document: registration is only proven by a positive document number.
    return refused(
      'VENDOR_UNDOCUMENTED',
      classification.kind === 'UNEXPECTED'
        ? classification.detail
        : 'the registration answer carried no document number',
    );
  }
}
