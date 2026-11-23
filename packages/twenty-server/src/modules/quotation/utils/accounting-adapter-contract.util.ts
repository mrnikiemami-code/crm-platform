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

const TAX_CODE_AND_AMOUNT = 'TAX_CODE_AND_AMOUNT';
const SINGLE_CURRENCY = 'SINGLE_CURRENCY';

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
  // Tax travels as a coded special-item row whose Price is the amount, and amounts are
  // booked in one currency with no currency parameter anywhere in the documented payload.
  taxHandling: TAX_CODE_AND_AMOUNT,
  currencyHandling: SINGLE_CURRENCY,
  baseCurrency: 'IRR',
  transportIsSecure: false,
  // Asan documents whole-list reads only; declaring it paged would re-download the list.
  readStrategy: 'REMOTE_UNPAGED',
} as const;

// The mock's closed profile set, mirroring the app's mock-profiles.ts. Expanding the profile
// HERE — not reading capabilities from the body — is what keeps a mock record from claiming
// a contract the app does not implement.
const MOCK_PROFILE_CAPABILITIES: Record<
  string,
  { taxHandling: string; currencyHandling: string; baseCurrency: string }
> = {
  SIMPLE: {
    taxHandling: 'TAX_RATE',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  CODED: {
    taxHandling: 'TAX_CODE',
    currencyHandling: 'CURRENCY_CODE',
    baseCurrency: '',
  },
  AMOUNT: {
    taxHandling: 'TAX_AMOUNT',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  NO_TAX: {
    taxHandling: 'UNSUPPORTED',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
};

const DEFAULT_MOCK_PROFILE = 'SIMPLE';

const mockCapabilities = (profile: unknown): Record<string, unknown> => {
  const key =
    typeof profile === 'string' && profile in MOCK_PROFILE_CAPABILITIES
      ? profile
      : DEFAULT_MOCK_PROFILE;
  const financial = MOCK_PROFILE_CAPABILITIES[key];

  return {
    ...ASAN_CAPABILITIES,
    taxHandling: financial.taxHandling,
    currencyHandling: financial.currencyHandling,
    baseCurrency: financial.baseCurrency,
  } as unknown as Record<string, unknown>;
};

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
    capabilities: mockCapabilities(DEFAULT_MOCK_PROFILE),
    healthProbe: null,
  },
};

export const accountingAdapterContract = (
  adapterId: string,
  options: { mockProfile?: unknown } = {},
): AccountingAdapterContract | null => {
  const id = adapterId.trim();
  const base = ACCOUNTING_ADAPTER_CONTRACTS[id] ?? null;

  if (base === null) {
    return null;
  }

  if (id !== 'mock') {
    return base;
  }

  return { ...base, capabilities: mockCapabilities(options.mockProfile) };
};

export const accountingAdapterCapabilities = (
  adapterId: string,
  options: { mockProfile?: unknown } = {},
): Record<string, unknown> | null =>
  accountingAdapterContract(adapterId, options)?.capabilities ?? null;
