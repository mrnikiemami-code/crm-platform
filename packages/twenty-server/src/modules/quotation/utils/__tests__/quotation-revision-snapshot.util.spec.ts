import {
  buildQuotationRevisionSnapshot,
  canonicalizeForHash,
  hashQuotationRevision,
  type QuotationRevisionLineRow,
  type QuotationRevisionHeaderRow,
  type QuotationRevisionSnapshot,
} from 'src/modules/quotation/utils/quotation-revision-snapshot.util';

// This fixture is the shared fingerprint between the server writer and the app reader:
// the same constant is asserted in
// `packages/twenty-apps/internal/quotation/src/domain/quotation/__tests__/revision.test.ts`.
// If either canonical form drifts, one of the two tests fails.
const SHARED_FIXTURE_HASH =
  '5df2777760c29c491e64f25c66741a7c7ecfe0f3014da72619c486b79b26ea6d';

const SHARED_FIXTURE_CANONICAL =
  '{"currencyCode":"IRR","customerRef":"c-1","issuedAt":"2026-11-21T08:00:00.000Z","lines":[{"description":"خدمت","discountMicros":"100000000","lineId":"l-1","quantityScaled":"1000000","taxMicros":"81000000","totalMicros":"981000000","unit":"ساعت","unitPriceMicros":"1000000000"}],"paymentTerms":null,"quotationId":"q-1","quotationNumber":"QT-1405-000001","taxPolicy":"VAT_9","taxRateBasisPoints":"900","totals":{"discountMicros":"100000000","grossMicros":"1000000000","netMicros":"900000000","taxMicros":"81000000","totalMicros":"981000000"},"version":1}';

const SHARED_SNAPSHOT: QuotationRevisionSnapshot = {
  quotationId: 'q-1',
  version: 1,
  quotationNumber: 'QT-1405-000001',
  currencyCode: 'IRR',
  customerRef: 'c-1',
  taxPolicy: 'VAT_9',
  taxRateBasisPoints: '900',
  paymentTerms: null,
  lines: [
    {
      lineId: 'l-1',
      description: 'خدمت',
      unit: 'ساعت',
      quantityScaled: '1000000',
      unitPriceMicros: '1000000000',
      discountMicros: '100000000',
      taxMicros: '81000000',
      totalMicros: '981000000',
    },
  ],
  totals: {
    grossMicros: '1000000000',
    discountMicros: '100000000',
    netMicros: '900000000',
    taxMicros: '81000000',
    totalMicros: '981000000',
  },
  issuedAt: '2026-11-21T08:00:00.000Z',
};

const header: QuotationRevisionHeaderRow = {
  id: 'q-1',
  quotationNumber: 'QT-1405-000001',
  currencyCode: 'IRR',
  taxPolicy: 'VAT_9',
  taxRateBasisPoints: '900',
  dutyRateBasisPoints: null,
  paymentTerms: null,
  grossExact: '1000.000000',
  lineDiscountExact: '100.000000',
  documentDiscountExact: '0.000000',
  netExact: '900.000000',
  taxExact: '81.000000',
  dutyExact: '0.000000',
  roundingExact: '0.000000',
  totalExact: '981.000000',
  personId: null,
  companyId: 'c-1',
};

const line: QuotationRevisionLineRow = {
  id: 'l-1',
  description: 'خدمت',
  name: 'خدمت',
  unit: 'ساعت',
  quantityExact: '1.000000',
  unitPriceExact: '1000.000000',
  grossExact: '1000.000000',
  discountExact: '100.000000',
  documentDiscountExact: '0.000000',
  taxExact: '81.000000',
  totalExact: '981.000000',
};

const build = (overrides?: {
  header?: Partial<typeof header>;
  lines?: QuotationRevisionLineRow[];
}) =>
  buildQuotationRevisionSnapshot({
    header: { ...header, ...(overrides?.header ?? {}) },
    lines: overrides?.lines ?? [line],
    version: 1,
    issuedAt: new Date('2026-11-21T08:00:00.000Z'),
  });

describe('quotation revision snapshot', () => {
  it('matches the canonical form the app hashes', () => {
    expect(canonicalizeForHash(SHARED_SNAPSHOT)).toBe(SHARED_FIXTURE_CANONICAL);
    expect(hashQuotationRevision(SHARED_SNAPSHOT)).toBe(SHARED_FIXTURE_HASH);
  });

  it('builds the same bytes from stored exact amounts', () => {
    const built = build();

    expect(built.ok).toBe(true);

    if (!built.ok) {
      return;
    }

    expect(built.snapshot).toEqual(SHARED_SNAPSHOT);
    expect(hashQuotationRevision(built.snapshot)).toBe(SHARED_FIXTURE_HASH);
  });

  it('records every discount the customer received', () => {
    const built = build({
      header: {
        documentDiscountExact: '50.000000',
        lineDiscountExact: '50.000000',
        netExact: '900.000000',
      },
      lines: [
        {
          ...line,
          discountExact: '50.000000',
          documentDiscountExact: '50.000000',
        },
      ],
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      expect(built.snapshot.totals.discountMicros).toBe('100000000');
    }
  });

  // One policy, two components: the sealed tax stays the combined figure every payable
  // invariant is expressed in, and the split is recorded beside it.
  it('seals tax and duty separately while keeping tax their sum', () => {
    const built = build({
      header: {
        taxRateBasisPoints: '600',
        dutyRateBasisPoints: '300',
        taxExact: '81.000000',
        dutyExact: '27.000000',
      },
    });

    expect(built.ok).toBe(true);

    if (built.ok) {
      expect(built.snapshot.totals.taxOnlyMicros).toBe('54000000');
      expect(built.snapshot.totals.dutyMicros).toBe('27000000');
      expect(built.snapshot.totals.taxMicros).toBe('81000000');
      expect(built.snapshot.dutyRateBasisPoints).toBe('300');
    }
  });

  it('does not add duty keys to a revision sealed without duty', () => {
    const built = build();

    expect(built.ok).toBe(true);

    if (built.ok) {
      expect('dutyRateBasisPoints' in built.snapshot).toBe(false);
      expect('dutyMicros' in built.snapshot.totals).toBe(false);
      expect('taxOnlyMicros' in built.snapshot.totals).toBe(false);
    }
  });

  it('refuses duty that is larger than the tax it is part of', () => {
    const built = build({
      header: {
        taxRateBasisPoints: '600',
        dutyRateBasisPoints: '900',
        taxExact: '81.000000',
        dutyExact: '121.000000',
      },
    });

    expect(built.ok).toBe(false);

    if (!built.ok) {
      expect(built.code).toBe('TOTALS_INCONSISTENT');
    }
  });

  it('refuses a duty-bearing revision with no sealed duty rate', () => {
    const built = build({
      header: { dutyExact: '27.000000' },
    });

    expect(built.ok).toBe(false);

    if (!built.ok) {
      expect(built.code).toBe('TOTALS_INCONSISTENT');
      expect(built.detail).toBe('header carries duty but no duty rate was sealed');
    }
  });

  it('refuses a header total that does not match its lines', () => {
    const built = build({ header: { totalExact: '982.000000' } });

    expect(built).toEqual({
      ok: false,
      code: 'TOTALS_INCONSISTENT',
      detail: 'header total is not net plus tax plus rounding',
    });
  });

  it('refuses an amount that is not an exact decimal', () => {
    const built = build({ lines: [{ ...line, taxExact: '81.0000001' }] });

    expect(built.ok).toBe(false);

    if (!built.ok) {
      expect(built.code).toBe('AMOUNT_NOT_A_DECIMAL');
    }
  });

  it('refuses a document without a number', () => {
    const built = build({ header: { quotationNumber: '  ' } });

    expect(built.ok).toBe(false);

    if (!built.ok) {
      expect(built.code).toBe('QUOTATION_NUMBER_MISSING');
    }
  });

  it('refuses a document without lines', () => {
    const built = build({ lines: [] });

    expect(built.ok).toBe(false);

    if (!built.ok) {
      expect(built.code).toBe('DOCUMENT_HAS_NO_LINES');
    }
  });

  it('keeps an empty payment term as null instead of an empty string', () => {
    const built = build({ header: { paymentTerms: '   ' } });

    expect(built.ok).toBe(true);

    if (built.ok) {
      expect(built.snapshot.paymentTerms).toBeNull();
    }
  });
});

describe('V2 sealed facts', () => {
  const customer = { id: 'c-1', kind: 'COMPANY' as const, name: 'شرکت نمونه',
    nationalCode: null, economicCode: null, registrationNumber: null, accountingCode: '100',
    customerCode: null, mobile: null, phone: null, secondPhone: null, fax: null, email: null,
    address: { street1: null, street2: null, city: null, state: null, postcode: null, country: null } };
  it('separates the revision sequence from the quotation version and stores item and discount shares', () => {
    const result = buildQuotationRevisionSnapshot({
      header: { ...header, lineDiscountExact: '50.000000', documentDiscountExact: '50.000000' },
      lines: [{ ...line, itemId: 'item-1', itemSku: 'SKU1', itemAccountingCode: '0020',
        discountExact: '50.000000', documentDiscountExact: '50.000000' }],
      version: 12, issuedAt: new Date('2026-11-21T08:00:00.000Z'),
      identity: { revisionNumber: 2, customer },
    });
    expect(result).toMatchObject({ ok: true, snapshot: { schemaVersion: 2, revisionNumber: 2, version: 12,
      customerSnapshot: customer, lines: [{ itemId: 'item-1', itemSku: 'SKU1', itemAccountingCode: '0020',
        grossMicros: '1000000000', discountMicros: '50000000', documentDiscountMicros: '50000000' }],
      totals: { lineDiscountMicros: '50000000', documentDiscountMicros: '50000000' } } });
  });
  it('refuses customer substitution and inconsistent line arithmetic', () => {
    const input = { header, lines: [line], version: 12, issuedAt: new Date('2026-11-21T08:00:00.000Z') };
    expect(buildQuotationRevisionSnapshot({ ...input, identity: { revisionNumber: 2, customer: { ...customer, id: 'other' } } }).ok).toBe(false);
    expect(buildQuotationRevisionSnapshot({ ...input, lines: [{ ...line, quantityExact: '2.000000' }],
      identity: { revisionNumber: 2, customer } }).ok).toBe(false);
  });
});
