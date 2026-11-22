// The server-side declaration of what each accounting adapter can do.
//
// The settings page used to send its own `capabilities` object, and the save stored it:
// an authorized caller could therefore claim a destination cannot register pro-formas (or
// can do more than it can) and change every later export decision. Capabilities are a
// property of the adapter contract, not of the request, so they are derived here from the
// adapter id and never read from the body.
//
// This is a contract description, not a second adapter: no vendor call, mapping or write
// lives here, and the probe path is the documented read-only endpoint.

export type AccountingAdapterContract = {
  isLive: boolean;
  contractVersion: string;
  capabilities: Record<string, unknown>;
  // `null` means "no network probe": a mock destination is answered in memory.
  healthProbe: { path: string; query?: Record<string, string> } | null;
};

// Mirrors packages/twenty-apps/internal/quotation/src/domain/accounting/adapters/asan/
// asan-capabilities.ts endpoint by endpoint. The cost of the duplication is a visible
// change here whenever the vendor contract changes; the alternative is a caller deciding
// what the vendor supports.
const ASAN_CAPABILITIES = {
  items: {
    list: true,
    read: true,
    create: true,
    updateFields: 'PRICE_ONLY',
    delete: false,
    listPrices: true,
    readStock: true,
  },
  parties: {
    list: true,
    read: true,
    create: true,
    update: true,
    assignsOwnCode: true,
    returnsAssignedCode: false,
  },
  documents: {
    createProforma: true,
    createInvoice: true,
    readDocuments: true,
    readById: false,
    updateDocument: false,
    cancelDocument: false,
    remoteIdempotency: false,
    acceptsCallerDocumentNumber: true,
  },
  requiresSpecialItemCodes: true,
  transportIsSecure: false,
} as const;

const ACCOUNTING_ADAPTER_CONTRACTS: Record<string, AccountingAdapterContract> = {
  asan: {
    isLive: true,
    contractVersion: '2026-11-1',
    capabilities: ASAN_CAPABILITIES as unknown as Record<string, unknown>,
    healthProbe: { path: 'ProductsNew/LastProducts', query: { Count: '1' } },
  },
  mock: {
    isLive: false,
    contractVersion: '2026-11-1',
    capabilities: ASAN_CAPABILITIES as unknown as Record<string, unknown>,
    healthProbe: null,
  },
};

export const accountingAdapterContract = (
  adapterId: string,
): AccountingAdapterContract | null =>
  ACCOUNTING_ADAPTER_CONTRACTS[adapterId.trim()] ?? null;

export const accountingAdapterCapabilities = (
  adapterId: string,
): Record<string, unknown> | null =>
  accountingAdapterContract(adapterId)?.capabilities ?? null;
