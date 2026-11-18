import { describe, expect, it } from 'vitest';

import { computeLineAmounts } from 'src/domain/money/line';
import {
  buildQuotationRevisionLine,
  canonicalizeForHash,
  checkLinesMutable,
  checkRevisionUnchanged,
  hashQuotationRevision,
  nextRevisionVersion,
  type QuotationRevisionSnapshot,
} from 'src/domain/quotation/revision';

const snapshot = (): QuotationRevisionSnapshot => {
  const amounts = computeLineAmounts({
    quantityScaled: 1_000_000n,
    unitPriceMicros: 4_400_000_000n,
    discount: { kind: 'NONE' },
    taxRateBasisPoints: 900n,
  });

  if (!amounts.ok) {
    throw new Error('fixture must compute');
  }

  return {
    quotationId: 'q-1',
    version: 1,
    quotationNumber: 'QT-1403-000123',
    currencyCode: 'IRR',
    customerRef: 'company-9',
    taxPolicy: 'IR_VAT_9',
    paymentTerms: '۳۰ روز',
    lines: [
      buildQuotationRevisionLine({
        lineId: 'line-1',
        description: 'خدمت مشاوره',
        unit: 'ساعت',
        quantityScaled: 1_000_000n,
        unitPriceMicros: 4_400_000_000n,
        amounts: amounts.value,
      }),
    ],
    totals: {
      grossMicros: '4400000000',
      discountMicros: '0',
      netMicros: '4400000000',
      taxMicros: '396000000',
      totalMicros: '4796000000',
    },
    issuedAt: '2026-11-18T12:00:00.000Z',
  };
};

describe('canonical form', () => {
  it('orders object keys so key order cannot change the hash', () => {
    const left = canonicalizeForHash({ b: 1, a: 2 });
    const right = canonicalizeForHash({ a: 2, b: 1 });

    expect(left).toBe(right);
  });

  it('keeps array order significant', () => {
    expect(canonicalizeForHash([1, 2])).not.toBe(canonicalizeForHash([2, 1]));
  });

  it('drops undefined members instead of inventing them', () => {
    expect(canonicalizeForHash({ a: 1, b: undefined })).toBe(
      canonicalizeForHash({ a: 1 }),
    );
  });
});

describe('revision hash', () => {
  it('is stable for the same snapshot', () => {
    expect(hashQuotationRevision(snapshot())).toBe(
      hashQuotationRevision(snapshot()),
    );
  });

  it('is stable when the snapshot is rebuilt with different key order', () => {
    const original = snapshot();
    const reordered: QuotationRevisionSnapshot = {
      totals: original.totals,
      lines: original.lines,
      issuedAt: original.issuedAt,
      taxPolicy: original.taxPolicy,
      paymentTerms: original.paymentTerms,
      customerRef: original.customerRef,
      currencyCode: original.currencyCode,
      quotationNumber: original.quotationNumber,
      version: original.version,
      quotationId: original.quotationId,
    };

    expect(hashQuotationRevision(reordered)).toBe(hashQuotationRevision(original));
  });

  it('changes when a single micro changes', () => {
    const original = snapshot();
    const tampered: QuotationRevisionSnapshot = {
      ...original,
      totals: { ...original.totals, totalMicros: '4796000001' },
    };

    expect(hashQuotationRevision(tampered)).not.toBe(
      hashQuotationRevision(original),
    );
  });

  it('changes when a line description changes', () => {
    const original = snapshot();
    const tampered: QuotationRevisionSnapshot = {
      ...original,
      lines: original.lines.map((line) => ({
        ...line,
        description: `${line.description} (ویرایش)`,
      })),
    };

    expect(hashQuotationRevision(tampered)).not.toBe(
      hashQuotationRevision(original),
    );
  });

  it('is a hex sha256', () => {
    expect(hashQuotationRevision(snapshot())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('immutability', () => {
  it('accepts an unchanged revision', () => {
    const stored = snapshot();
    const result = checkRevisionUnchanged({
      storedHash: hashQuotationRevision(stored),
      proposedSnapshot: snapshot(),
    });

    expect(result.ok).toBe(true);
  });

  it('refuses any change to a stored revision', () => {
    const result = checkRevisionUnchanged({
      storedHash: hashQuotationRevision(snapshot()),
      proposedSnapshot: {
        ...snapshot(),
        paymentTerms: '۶۰ روز',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.refusal.code).toBe('REVISION_IMMUTABLE');
  });

  it('lets a draft be edited but not a sent document', () => {
    expect(checkLinesMutable('DRAFT').ok).toBe(true);
    expect(checkLinesMutable('SENT').ok).toBe(false);
    expect(checkLinesMutable('CUSTOMER_ACCEPTED').ok).toBe(false);

    const refused = checkLinesMutable('SENT');

    expect(refused.ok ? '' : refused.refusal.code).toBe(
      'QUOTATION_LINES_FROZEN',
    );
  });
});

describe('version numbering', () => {
  it('starts at one', () => {
    expect(nextRevisionVersion([])).toBe(1);
  });

  it('increments from the highest existing version, not the count', () => {
    // A deleted revision must not let a later one reuse its number.
    expect(nextRevisionVersion([1, 2, 4])).toBe(5);
    expect(nextRevisionVersion([3])).toBe(4);
  });
});
