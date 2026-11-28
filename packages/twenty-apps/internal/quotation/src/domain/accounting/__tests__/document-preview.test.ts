import { describe, expect, it } from 'vitest';

import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import { type AdapterCapabilities } from 'src/domain/accounting/capabilities';
import { buildQuotationDocumentPreview } from 'src/domain/accounting/document-preview';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

// A destination that publishes one 9% code: 6% tax + 3% duty.
const codedCapabilities: AdapterCapabilities = {
  ...ASAN_CAPABILITIES,
  taxHandling: 'TAX_CODE',
  dutyHandling: 'DUTY_WITHIN_POLICY',
  taxCodeCatalog: [
    {
      code: '64',
      label: '۹٪ (۶ + ۳)',
      totalRateBasisPoints: '900',
      taxRateBasisPoints: '600',
      dutyRateBasisPoints: '300',
    },
  ],
};

const unlistedCapabilities: AdapterCapabilities = {
  ...codedCapabilities,
  taxCodeCatalog: undefined,
};

const settings = (
  overrides: Partial<ConnectionSettings> = {},
): ConnectionSettings => ({
  baseUrl: 'https://mock.invalid',
  remoteUserId: '7',
  defaultStorageId: '3',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: true },
  taxPolicyMappings: {},
  specialItemCodes: { discount: '999123', duty: '999140', tax: '999141' },
  ...overrides,
});

const snapshot: QuotationRevisionSnapshot = {
  quotationId: 'quotation-1',
  version: 1,
  quotationNumber: 'Q-100',
  currencyCode: 'IRR',
  customerRef: 'person-1',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: '900',
  paymentTerms: null,
  lines: [
    {
      lineId: 'line-1',
      description: 'کابل شبکه',
      unit: 'عدد',
      quantityScaled: '2000000',
      unitPriceMicros: '100000000',
      discountMicros: '0',
      taxMicros: '18000000',
      totalMicros: '218000000',
    },
  ],
  totals: {
    grossMicros: '200000000',
    discountMicros: '0',
    netMicros: '200000000',
    taxMicros: '18000000',
    totalMicros: '218000000',
  },
  issuedAt: '2026-11-22T00:00:00.000Z',
};

const build = (
  overrides: {
    settings?: ConnectionSettings;
    capabilities?: AdapterCapabilities;
    customerExternalId?: string | null;
    externalItemId?: string | null;
    revision?: QuotationRevisionSnapshot | null;
  } = {},
) =>
  buildQuotationDocumentPreview({
    revision: overrides.revision === undefined ? snapshot : overrides.revision,
    quotationStatus: 'CUSTOMER_ACCEPTED',
    quotationName: 'پیش‌فاکتور آزمایشی',
    settings: overrides.settings ?? settings(),
    capabilities: overrides.capabilities ?? ASAN_CAPABILITIES,
    flags: { outboundEnabled: false, documentExportEnabled: false },
    customerExternalId:
      overrides.customerExternalId === undefined
        ? '801001'
        : overrides.customerExternalId,
    lineLinks: [
      {
        lineId: 'line-1',
        externalItemId:
          overrides.externalItemId === undefined
            ? '1001'
            : overrides.externalItemId,
      },
    ],
  });

describe('buildQuotationDocumentPreview', () => {
  it('builds the destination document with the same mapper the dispatch uses', () => {
    const preview = build();

    expect(preview.documentError).toBeNull();
    expect(preview.document).not.toBeNull();
    expect(preview.document?.CustomerID).toBe(801001);
    expect(preview.document?.UserID).toBe(7);
    // One product line plus the vendor's tax special-code line (Count 0), exactly as the
    // real mapper builds it.
    expect(preview.document?.FactorDetails).toHaveLength(2);
    expect(preview.document?.FactorDetails[0].ProductID).toBe(1001);
    expect(preview.document?.FactorDetails[0].Count).toBe(2);
    expect(preview.document?.FactorDetails[0].Price).toBe(200);
    expect(preview.document?.FactorDetails[1].Price).toBe(18);
    expect(preview.lines[0].totalMicros).toBe('218.000000');
    expect(preview.document?.FactorDetails[1].Count).toBe(0);
    expect(preview.checks.every((check) => check.code !== 'CUSTOMER_LINKED' || check.ok)).toBe(true);
    expect(preview.lines[0].problem).toBeNull();
    expect(preview.outboundEnabled).toBe(false);
    expect(preview.documentExportEnabled).toBe(false);
  });

  it('keeps the document unbuilt while no CRM customer is linked', () => {
    const preview = build({ customerExternalId: null });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('CUSTOMER_NOT_LINKED');
    expect(preview.checks.find((check) => check.code === 'CUSTOMER_LINKED')?.ok).toBe(false);
  });

  it('refuses to convert amounts while the vendor unit is unconfirmed', () => {
    const preview = build({
      settings: settings({ moneyUnit: 'UNCONFIRMED' }),
    });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('MONEY_UNIT_UNCONFIRMED');
    expect(preview.checks.find((check) => check.code === 'MONEY_UNIT_CONFIRMED')?.ok).toBe(false);
  });

  it('marks a line whose vendor item id is not usable instead of dropping it', () => {
    const preview = build({ externalItemId: 'X-901' });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('LINE_HAS_NO_PRODUCT_LINK');
    expect(preview.lines[0].problem).toBe('LINE_HAS_NO_PRODUCT_LINK');
    expect(preview.checks.find((check) => check.code === 'ALL_LINES_LINKED')?.ok).toBe(false);
  });

  it('shows a missing revision instead of inventing a document', () => {
    const preview = build({ revision: null });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('REVISION_NOT_FOUND');
    expect(preview.lines).toHaveLength(0);
    expect(preview.checks.find((check) => check.code === 'REVISION_PRESENT')?.ok).toBe(false);
  });
});

describe('preview and dispatch share the same tax-code control', () => {
  const codedSettings = settings({
    taxPolicyMappings: { IR_VAT_9: '64' },
  });
  const ninePercentWithDuty = (
    overrides: Partial<QuotationRevisionSnapshot> = {},
  ): QuotationRevisionSnapshot => ({
    ...snapshot,
    taxRateBasisPoints: '600',
    dutyRateBasisPoints: '300',
    totals: {
      grossMicros: '200000000',
      discountMicros: '0',
      netMicros: '200000000',
      taxOnlyMicros: '12000000',
      dutyMicros: '6000000',
      taxMicros: '18000000',
      totalMicros: '218000000',
    },
    ...overrides,
  });

  it('builds the document when the code matches the sealed rate and split', () => {
    const preview = build({
      settings: codedSettings,
      capabilities: codedCapabilities,
      revision: ninePercentWithDuty(),
    });

    expect(preview.documentError).toBeNull();
    expect(preview.document).not.toBeNull();
    expect(preview.checks.find((check) => check.code === 'TAX_CODE_VERIFIED')?.ok).toBe(true);
    expect(preview.warnings).toEqual([]);
  });

  it('refuses the document when the code carries a different total rate', () => {
    const preview = build({
      settings: codedSettings,
      capabilities: {
        ...codedCapabilities,
        taxCodeCatalog: [
          {
            code: '64',
            label: '۱۰٪',
            totalRateBasisPoints: '1000',
            taxRateBasisPoints: '700',
            dutyRateBasisPoints: '300',
          },
        ],
      },
      revision: ninePercentWithDuty(),
    });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('TAX_CODE_RATE_MISMATCH');
  });

  it('refuses the document when the split differs although the total matches', () => {
    const preview = build({
      settings: codedSettings,
      capabilities: {
        ...codedCapabilities,
        taxCodeCatalog: [
          {
            code: '64',
            label: '۹٪ (۵ + ۴)',
            totalRateBasisPoints: '900',
            taxRateBasisPoints: '500',
            dutyRateBasisPoints: '400',
          },
        ],
      },
      revision: ninePercentWithDuty(),
    });

    expect(preview.document).toBeNull();
    expect(preview.documentError?.code).toBe('TAX_CODE_COMPOSITION_MISMATCH');
  });

  it('keeps an unpublished catalog non-blocking but says the match is not confirmed', () => {
    const preview = build({
      settings: codedSettings,
      capabilities: unlistedCapabilities,
      revision: ninePercentWithDuty(),
    });

    expect(preview.documentError).toBeNull();
    expect(preview.checks.find((check) => check.code === 'TAX_CODE_VERIFIED')?.ok).toBe(false);
    expect(preview.warnings).toEqual([
      { code: 'TAX_CODE_UNVERIFIED', detail: 'NO_CATALOG' },
    ]);
  });
});
