import { describe, expect, it } from 'vitest';

import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { type ConnectionSettings } from 'src/domain/accounting/adapter-contract';
import { buildQuotationDocumentPreview } from 'src/domain/accounting/document-preview';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

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
    capabilities: ASAN_CAPABILITIES,
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
