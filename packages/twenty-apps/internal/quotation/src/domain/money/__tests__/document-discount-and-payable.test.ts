import { describe, expect, it } from 'vitest';

import { allocateDocumentDiscount } from 'src/domain/money/document-discount';
import { finalizeLinesWithDocumentDiscount } from 'src/domain/money/document-totals';
import { computeLinePreTaxAmounts } from 'src/domain/money/line';
import {
  isWholeRialMicros,
  MICROS_PER_UNIT,
  roundMicrosToWholeRial,
} from 'src/domain/money/micros';
import { resolveTaxPolicy } from 'src/domain/money/tax-policy';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

describe('document discount allocation', () => {
  it('allocates proportionally with remainder on the last line', () => {
    const shares = unwrap(
      allocateDocumentDiscount(
        [
          { netAfterLineDiscountMicros: 700n },
          { netAfterLineDiscountMicros: 300n },
        ],
        100n,
      ),
    );

    expect(shares[0] + shares[1]).toBe(100n);
    expect(shares[0]).toBe(70n);
    expect(shares[1]).toBe(30n);
  });

  it('refuses a discount larger than the discountable net', () => {
    const result = allocateDocumentDiscount(
      [{ netAfterLineDiscountMicros: 50n }],
      51n,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.refusal.code).toBe('DOCUMENT_DISCOUNT_EXCEEDS_NET');
  });
});

describe('finalizeLinesWithDocumentDiscount', () => {
  it('taxes after line and document discounts and pays a whole rial', () => {
    const lineA = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 10_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'RATE', basisPoints: 1_000n },
      }),
    );
    const lineB = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 2_500_000n,
        unitPriceMicros: 1_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'NONE' },
      }),
    );

    const taxPolicy = unwrap(resolveTaxPolicy('IR_VAT_9'));
    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [lineA, lineB],
        documentDiscount: { kind: 'AMOUNT', micros: 500_000n * MICROS_PER_UNIT },
        taxRateBasisPoints: taxPolicy.rateBasisPoints,
      }),
    );

    expect(finalized.totals.documentDiscountMicros).toBe(
      500_000n * MICROS_PER_UNIT,
    );
    expect(
      finalized.lines[0].documentDiscountMicros +
        finalized.lines[1].documentDiscountMicros,
    ).toBe(finalized.totals.documentDiscountMicros);
    expect(isWholeRialMicros(finalized.totals.totalMicros)).toBe(true);
    expect(finalized.totals.totalMicros).toBe(
      finalized.totals.netMicros + finalized.totals.taxMicros,
    );
    expect(finalized.totals.netMicros).toBe(
      finalized.totals.grossMicros - finalized.totals.discountMicros,
    );
  });

  it('combines percent line discount with percent document discount', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'RATE', basisPoints: 1_000n },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'RATE', basisPoints: 1_000n },
        taxRateBasisPoints: 900n,
      }),
    );

    // gross 1_000_000 rial, line 10% → 900_000, doc 10% → 90_000, net 810_000
    // tax 9% → 72_900, total 882_900 whole rial
    expect(finalized.totals.grossMicros).toBe(1_000_000n * MICROS_PER_UNIT);
    expect(finalized.totals.lineDiscountMicros).toBe(100_000n * MICROS_PER_UNIT);
    expect(finalized.totals.documentDiscountMicros).toBe(
      90_000n * MICROS_PER_UNIT,
    );
    expect(finalized.totals.netMicros).toBe(810_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxMicros).toBe(72_900n * MICROS_PER_UNIT);
    expect(finalized.totals.totalMicros).toBe(882_900n * MICROS_PER_UNIT);
  });
});

describe('whole rial payable', () => {
  it('rounds half-up to the nearest whole rial', () => {
    expect(roundMicrosToWholeRial(1_500_000n)).toBe(2_000_000n);
    expect(roundMicrosToWholeRial(1_499_999n)).toBe(1_000_000n);
    expect(roundMicrosToWholeRial(2_000_000n)).toBe(2_000_000n);
  });
});

describe('tax policy registry', () => {
  it('resolves the existing IR_VAT_9 policy only', () => {
    expect(unwrap(resolveTaxPolicy('IR_VAT_9')).rateBasisPoints).toBe(900n);
    expect(resolveTaxPolicy('IR_VAT_10').ok).toBe(false);
  });
});
