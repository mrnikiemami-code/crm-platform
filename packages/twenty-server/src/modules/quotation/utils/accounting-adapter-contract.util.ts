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

const TAX_CODE = 'TAX_CODE';
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
    fields: { contractVersion: '2', identity: 'CUSTOMER_CODE', readable: ["code","fullName","mobile","nationalCode","legalNationalId","firstPhone","secondPhone","fax","economicCode","address","postalCode","accountGroup"], writable: ["fullName","mobile","nationalCode","legalNationalId","firstPhone","secondPhone","fax","economicCode","address","postalCode","accountGroup"] },
    list: true,
    read: true,
    create: true,
    update: true,
    assignsOwnCode: true,
    returnsAssignedCode: false,
  },
  documents: {
    createProforma: true,
    // Invoice is documented, not executable; the recent pro-forma report is implemented.
    createInvoice: false,
    readDocuments: true,
    readById: false,
    updateDocument: false,
    cancelDocument: false,
    remoteIdempotency: false,
    acceptsCallerDocumentNumber: true,
  },
  requiresSpecialItemCodes: true,
  // Tax travels as a special-item row whose Price is the amount. The row's ProductID is the
  // installation's own pre-existing item code, NOT a per-policy code: Asan reads no CRM
  // policy id, so the contract is amount-based and the single policy code rule does not
  // apply to it.
  taxHandling: 'TAX_AMOUNT',
  // Duty is its own special-item row (a different row code, same amount mechanism),
  // declared apart from tax so neither component can stand in for the other.
  dutyHandling: 'DUTY_AMOUNT',
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
  {
    taxHandling: string;
    dutyHandling: string;
    currencyHandling: string;
    baseCurrency: string;
    taxCodeCatalog?: readonly {
      code: string;
      label: string;
      totalRateBasisPoints: string;
      taxRateBasisPoints?: string;
      dutyRateBasisPoints?: string;
    }[];
  }
> = {
  SIMPLE: {
    taxHandling: 'TAX_RATE',
    dutyHandling: 'DUTY_RATE',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  PARTY_UAT: { taxHandling: 'TAX_RATE', dutyHandling: 'DUTY_RATE', currencyHandling: SINGLE_CURRENCY, baseCurrency: 'IRR' },
  CODED: {
    // ONE code per policy. The code stands for the whole value-added treatment, so duty has
    // no field of its own and no second code is ever requested.
    taxHandling: TAX_CODE,
    dutyHandling: 'DUTY_WITHIN_POLICY',
    currencyHandling: 'CURRENCY_CODE',
    baseCurrency: '',
    // Only a destination that publishes its code rates can be checked; the mock publishes
    // two so the comparison is demonstrable without claiming anything about a real vendor.
    taxCodeCatalog: [
      {
        code: '64',
        label: 'مالیات ارزش افزوده ۹٪ (۶٪ مالیات + ۳٪ عوارض)',
        totalRateBasisPoints: '900',
        taxRateBasisPoints: '600',
        dutyRateBasisPoints: '300',
      },
      {
        code: '70',
        label: 'مالیات ارزش افزوده ۱۰٪ (۷٪ مالیات + ۳٪ عوارض)',
        totalRateBasisPoints: '1000',
        taxRateBasisPoints: '700',
        dutyRateBasisPoints: '300',
      },
    ],
  },
  AMOUNT: {
    taxHandling: 'TAX_AMOUNT',
    dutyHandling: 'DUTY_AMOUNT',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  // An aggregate contract accepts only tax+duty together; it is a documented destination
  // shape, not a convenience the CRM may assume for any other vendor.
  AGGREGATE: {
    taxHandling: 'TAX_AMOUNT',
    dutyHandling: 'AGGREGATE',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  TAX_ONLY: {
    taxHandling: 'TAX_RATE',
    dutyHandling: 'UNSUPPORTED',
    currencyHandling: SINGLE_CURRENCY,
    baseCurrency: 'IRR',
  },
  NO_TAX: {
    taxHandling: 'UNSUPPORTED',
    dutyHandling: 'UNSUPPORTED',
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
    // Preserve the existing test profile contract; these are not live vendor claims.
    documents: { ...ASAN_CAPABILITIES.documents, createInvoice: true, readDocuments: true },
    parties: { ...ASAN_CAPABILITIES.parties, fields: { contractVersion: '2', identity: 'EXTERNAL_ID', readable: ["code","fullName","mobile","nationalCode","partyType","firstName","lastName","companyName","tradeName","legalNationalId","economicCode","registrationNumber","crmCustomerCode","accountingCode","generalLedgerCode","subsidiaryLedgerCode","detailLedgerCode","accountGroup","firstPhone","secondPhone","fax","email","address","postalCode","country","state","city","contactName","paymentTermsCode","settlementDays","creditLimitExact","creditLimitCurrency","isActive"], writable: ["fullName","mobile","nationalCode","partyType","firstName","lastName","companyName","tradeName","legalNationalId","economicCode","registrationNumber","crmCustomerCode","accountingCode","generalLedgerCode","subsidiaryLedgerCode","detailLedgerCode","accountGroup","firstPhone","secondPhone","fax","email","address","postalCode","country","state","city","contactName","paymentTermsCode","settlementDays","creditLimitExact","creditLimitCurrency","isActive"] } },
    // A mock destination has no vendor installation, so it declares no special-row codes:
    // those belong to Asan's documented payload, not to a test profile.
    requiresSpecialItemCodes: false,
    taxHandling: financial.taxHandling,
    dutyHandling: financial.dutyHandling,
    currencyHandling: financial.currencyHandling,
    baseCurrency: financial.baseCurrency,
    ...(financial.taxCodeCatalog === undefined
      ? {}
      : { taxCodeCatalog: financial.taxCodeCatalog }),
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
