import { type AdapterCapabilities } from 'src/domain/accounting/capabilities';
import { type FinancialSettings } from 'src/domain/accounting/financial-contract';
import { type Result } from 'src/domain/shared/result';

// The contract every accounting vendor is wired through. The CRM never calls a vendor
// endpoint directly: a route asks the connection for its adapter, and the adapter answers
// in these types. Adding Sepidar later means writing one more implementation of this
// contract, not another `if (vendor === ...)` branch inside a service.
//
// Everything that can fail returns `Result`, because an accounting endpoint failing is a
// normal outcome that must become a status on a record rather than an exception that
// loses the operation.
export const ACCOUNTING_ADAPTER_IDS = ['asan', 'mock'] as const;

export type AccountingAdapterId = (typeof ACCOUNTING_ADAPTER_IDS)[number];

export const isAccountingAdapterId = (
  value: unknown,
): value is AccountingAdapterId =>
  typeof value === 'string' &&
  (ACCOUNTING_ADAPTER_IDS as readonly string[]).includes(value);

// How much of the connection is proven, not merely configured. A mock adapter is never
// presented as a live connection, and a real adapter that was never reached stays
// LIVE_UNVERIFIED until a health check actually succeeds against the real server.
export const CONNECTION_VERIFICATION_STATES = [
  'MOCK',
  'LIVE_UNVERIFIED',
  'LIVE_VERIFIED',
] as const;

export type ConnectionVerificationState =
  (typeof CONNECTION_VERIFICATION_STATES)[number];

// The unit the remote stores amounts in. UNCONFIRMED is the only safe default: the Asan
// guide shows plain integers with no currency statement, so sending rial figures as toman
// (or the reverse) would be a factor-of-ten error on a customer-facing document.
export const ACCOUNTING_MONEY_UNITS = [
  'UNCONFIRMED',
  'RIAL',
  'TOMAN',
] as const;

export type AccountingMoneyUnit = (typeof ACCOUNTING_MONEY_UNITS)[number];

export type ConnectionSettings = {
  // Service address of the vendor API, for example http://127.0.0.1:8080.
  baseUrl: string;
  // The vendor user the CRM writes as. Not a CRM user id.
  remoteUserId: string;
  // Warehouse/storage the vendor should book a line into. Empty means the adapter default.
  defaultStorageId: string;
  moneyUnit: AccountingMoneyUnit;
  // Whether an approved tunnel terminates TLS in front of the vendor. Asan documents plain
  // HTTP, so the connection is only treated as secure when someone configured that.
  transportApproved: boolean;
  // Which of the vendor's special item codes actually exist in this installation.
  specialCodes: {
    discount: boolean;
    duty: boolean;
    tax: boolean;
  };
  // The vendor's actual special-row item codes for this installation. A row code identifies
  // WHICH pre-existing item a non-product amount is posted under (Asan documents 999123 /
  // 999140 / 999141); it is NOT a CRM tax policy id and NOT the tax rate. Absent entries
  // fall back to the adapter's documented defaults, and the form asks an operator to confirm
  // them instead of assuming they exist.
  specialItemCodes?: {
    discount?: string;
    duty?: string;
    tax?: string;
  };
  // CRM tax policy code -> the destination's own tax code, ONE code per policy, for
  // example IR_VAT_9 -> 64. The destination code represents the WHOLE value-added policy
  // (tax and duty together); the destination performs its own internal split. There is
  // deliberately no second, duty-specific mapping: asking for one would demand a fiscal
  // field the vendor's API does not document. A rate or amount destination reads the
  // figure from the document and is never asked for a code.
  taxPolicyMappings: Record<string, string>;
  // Currency base and code mapping, plus the test-only mock profile. Optional because a
  // record written before this block existed must still open; a missing block reads as the
  // conservative default, never as "no requirements".
  financial?: FinancialSettings;
};

export type RemoteCatalogItem = {
  externalItemId: string;
  code: string;
  name: string;
  secondaryName: string | null;
  // Whole vendor units (see `AccountingMoneyUnit`), not micros. Conversion to the CRM's
  // exact representation happens once, in `asan-money-unit.ts`.
  sellPriceUnits: number | null;
  salesPriceUnits: number[];
  stock: number | null;
  // The vendor's own change marker when it has one. Asan documents none, so the adapter
  // derives a stable marker from the record content instead of pretending otherwise.
  remoteVersion: string;
  isActive: boolean;
};

export type RemoteParty = {
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  remoteVersion: string;
};

export type RemoteDocument = {
  externalDocumentId: string;
  documentNumber: string;
  registeredAt: string | null;
};

export type AdapterHealth =
  | {
      kind: 'REACHABLE';
      // Whether the vendor answered the documented health probe. A readable error from the
      // vendor is still a REACHABLE transport, and that distinction matters: it says the
      // address and tunnel work and the remaining problem is configuration.
      checkedAt: string;
      latencyMs: number;
      transportIsSecure: boolean;
      detail: string;
    }
  | {
      kind: 'UNREACHABLE';
      checkedAt: string;
      latencyMs: number;
      transportIsSecure: boolean;
      code: 'TRANSPORT_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';
      detail: string;
    };

export type RemoteItemInput = {
  externalItemId: string | null;
  code: string;
  name: string;
  secondaryName: string | null;
  sellPriceUnits: number;
  salesPriceUnits: number[];
};

export type RemotePartyInput = {
  externalPartyId: string | null;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  address: string | null;
};

export type RemoteProformaInput = {
  // Vendor document payload in the vendor's own shape, already mapped and checked by the
  // vendor mapper. Passing it as `unknown` keeps this contract free of Asan field names.
  payload: unknown;
  // What an auditor needs to recognise the document without reading the payload.
  description: string;
};

// One page fetched from a destination that can page. Only a `REMOTE_PAGED` adapter
// implements this; `cursor` is the destination's own opaque token, never a local offset.
export type RemotePageRequest = {
  cursor: string | null;
  pageSize: number;
  search: string;
};

export type RemotePage<TRow> = {
  rows: TRow[];
  nextCursor: string | null;
  hasNextPage: boolean;
  // `null` when the destination cannot state a total. Guessing a total turns into
  // "page 1 of 40" on a list of 40 000.
  totalKnown: number | null;
};

export type AccountingAdapter = {
  readonly id: AccountingAdapterId;
  readonly contractVersion: string;
  readonly capabilities: AdapterCapabilities;
  // Whether this adapter talks to a real server. Mock is false, so no result it returns is
  // ever reported as verified against a vendor.
  readonly isLive: boolean;

  testConnection(): Promise<Result<AdapterHealth>>;
  // Whole-list reads. Required of every adapter because the `REMOTE_UNPAGED` path ingests
  // exactly this one response into a bounded snapshot.
  listItems(): Promise<Result<RemoteCatalogItem[]>>;
  listParties(): Promise<Result<RemoteParty[]>>;
  // Implemented only when `capabilities.readStrategy === 'REMOTE_PAGED'`. Its absence is the
  // machine-readable proof that the destination cannot page, so the reader falls back to
  // the bounded snapshot instead of guessing an offset the vendor does not accept.
  readItemPage?(
    request: RemotePageRequest,
  ): Promise<Result<RemotePage<RemoteCatalogItem>>>;
  readPartyPage?(
    request: RemotePageRequest,
  ): Promise<Result<RemotePage<RemoteParty>>>;
  createItem(input: RemoteItemInput): Promise<Result<RemoteCatalogItem>>;
  updateItemPrices(
    input: RemoteItemInput,
  ): Promise<Result<RemoteCatalogItem>>;
  createParty(input: RemotePartyInput): Promise<Result<RemoteParty>>;
  updateParty(input: RemotePartyInput): Promise<Result<RemoteParty>>;
  registerProforma(input: RemoteProformaInput): Promise<Result<RemoteDocument>>;
};

// The adapter contract version a connection is configured against. Stored on the
// connection so a behaviour change is deliberate: an old connection can be reported as
// needing a re-check instead of silently being judged by new rules.
export const ACCOUNTING_ADAPTER_CONTRACT_VERSION = '2026-11-1';
