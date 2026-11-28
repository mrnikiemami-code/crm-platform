import { createHash } from 'node:crypto';

import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { ASAN_ENDPOINTS, buildAsanUrl } from 'src/domain/accounting/adapters/asan/asan-endpoints';
import {
  mapItemPricesToAsanUpdate,
  mapItemToAsanProduct,
} from 'src/domain/accounting/adapters/asan/asan-product';
import {
  mapPartyToAsanCustomer,
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
  type RemoteDocument,
  type RemoteItemInput,
  type RemoteParty,
  type RemotePartyInput,
  type RemoteProformaInput,
} from 'src/domain/accounting/adapter-contract';
import { normalizeNationalCode, partyNationalIdentity } from 'src/domain/accounting/party-identity';
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
  // The explicit approval that lets a write use a non-TLS address (for example a loopback
  // tunnel that terminates TLS elsewhere). Default false, so a forgotten approval fails
  // closed instead of moving money over clear text.
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
const hashRecord = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

const parseProduct = (raw: unknown): RemoteCatalogItem | null => {
  const record = asRecord(raw);

  if (record === null) {
    return null;
  }

  const code = readNumber(record.ProductCode);

  if (code === null || !Number.isSafeInteger(code) || code <= 0) {
    return null;
  }

  const salesPrices = Array.isArray(record.SalesPrice)
    ? record.SalesPrice.map(readNumber).filter((price): price is number => price !== null)
    : [];

  return {
    externalItemId: String(code),
    code: String(code),
    name: readString(record.ProductName),
    secondaryName: readString(record.ProductName2) || null,
    sellPriceUnits: readNumber(record.SellPrice),
    salesPriceUnits: salesPrices,
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
  private readonly fetchImpl: AsanFetch;
  private readonly now: () => Date;

  constructor(config: AsanHttpAdapterConfig) {
    this.config = config;
    this.fetchImpl =
      config.fetchImpl ??
      ((input, init) => fetch(input, init));
    this.now = config.now ?? (() => new Date());
  }

  private transportIsSecure(): boolean {
    return this.config.baseUrl.trim().toLowerCase().startsWith('https://');
  }

  // Reads may use the documented plain-HTTP address: they carry no document and no amount.
  // Writes need TLS or an explicit approval, so a workspace that never configured a tunnel
  // cannot move data over clear text by accident.
  private checkWriteTransport(): Result<true> {
    if (this.transportIsSecure() || this.config.allowInsecureTransport === true) {
      return accepted(true);
    }

    return refused(
      'TRANSPORT_NOT_APPROVED',
      'writes to this destination require TLS or an explicitly approved tunnel',
    );
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
      response = await this.fetchImpl(
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
      return Number(parsed.value);
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
      detail: this.transportIsSecure()
        ? 'the vendor answered the documented read over TLS'
        : 'the vendor answered the documented read over plain HTTP; approve a tunnel before writing',
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

      // A row without a usable ProductCode cannot be linked to anything, so it is skipped
      // instead of being given a fabricated identity.
      if (item !== null) {
        items.push(item);
      }
    }

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

    return accepted(
      records
        .map(parseParty)
        .filter((party): party is RemoteParty => party !== null),
    );
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

    return accepted({
      externalItemId: String(mapped.value.ProductCode),
      code: String(mapped.value.ProductCode),
      name: mapped.value.ProductName,
      secondaryName: mapped.value.ProductName2 ?? null,
      sellPriceUnits: mapped.value.SellPrice,
      salesPriceUnits: mapped.value.SalesPrice ?? [],
      stock: null,
      // The create response is not documented as a record, so the version starts empty and
      // the next read establishes it.
      remoteVersion: '',
      isActive: true,
    });
  }

  async updateItemPrices(
    input: RemoteItemInput,
  ): Promise<Result<RemoteCatalogItem>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const mapped = mapItemPricesToAsanUpdate({
      productCode: Number(input.externalItemId ?? input.code),
      currentName: input.name,
      currentSecondaryName: input.secondaryName,
      sellPrice: input.sellPriceUnits,
      salesPrices: input.salesPriceUnits,
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

    return accepted({
      externalItemId: String(mapped.value.ProductCode),
      code: String(mapped.value.ProductCode),
      name: mapped.value.ProductName,
      secondaryName: mapped.value.ProductName2 ?? null,
      sellPriceUnits: mapped.value.SellPrice,
      salesPriceUnits: mapped.value.SalesPrice ?? [],
      stock: null,
      remoteVersion: '',
      isActive: true,
    });
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

    // The documented create response is a result flag, never the assigned PersonCode. The
    // lookup is best-effort: a customer created without a national code has no documented
    // way back to its code, so the caller gets an empty id and must re-read in Asan instead
    // of storing the flag "1" as an id.
    const identity = partyNationalIdentity(input);
    const assigned = identity === null ? null : await this.findPartyByNationalCode(identity);

    return accepted({
      externalPartyId: assigned?.externalPartyId ?? '',
      code: assigned?.code ?? '',
      fullName: input.fullName,
      mobile: input.mobile,
      nationalCode: input.nationalCode,
      remoteVersion: assigned?.remoteVersion ?? '',
    });
  }

  private async findPartyByNationalCode(
    nationalCode: string,
  ): Promise<RemoteParty | null> {
    const result = await this.request({
      path: ASAN_ENDPOINTS.customerByNationalCode,
      method: 'GET',
      query: { NationalCode: nationalCode },
    });

    if (!result.ok || result.value.status < 200 || result.value.status >= 300) {
      return null;
    }

    const parsed = this.parseJson(result.value.text);

    if (!parsed.ok) {
      return null;
    }

    const records = extractArray(parsed.value, [
      'data',
      'customers',
      'Customers',
    ]);

    const candidates = (records ?? [parsed.value]).map(parseParty).filter((party): party is RemoteParty => party !== null);
    const matches = candidates.filter((party) => partyNationalIdentity(party) === normalizeNationalCode(nationalCode));
    return matches.length === 1 ? matches[0] : null;
  }

  async updateParty(input: RemotePartyInput): Promise<Result<RemoteParty>> {
    const transport = this.checkWriteTransport();

    if (!transport.ok) {
      return transport;
    }

    const personCode = Number(input.externalPartyId ?? '');

    const mapped = mapPartyToAsanCustomer(
      {
        personCode: Number.isSafeInteger(personCode) ? personCode : null,
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

    const result = await this.request({
      path: ASAN_ENDPOINTS.editCustomer,
      method: 'POST',
      body: mapped.value,
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

    return accepted({
      externalPartyId: String(mapped.value.PersonCode),
      code: String(mapped.value.PersonCode),
      fullName: input.fullName,
      mobile: input.mobile,
      nationalCode: input.nationalCode,
      remoteVersion: '',
    });
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
