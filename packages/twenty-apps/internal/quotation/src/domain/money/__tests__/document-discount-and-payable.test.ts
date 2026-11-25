import { describe, expect, it } from 'vitest';

import { allocateDocumentDiscount } from 'src/domain/money/document-discount';
import { finalizeLinesWithDocumentDiscount } from 'src/domain/money/document-totals';
import { applyBasisPoints } from 'src/domain/money/arithmetic';
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

const assertAllocationInvariants = (
  nets: bigint[],
  discount: bigint,
  shares: bigint[],
) => {
  expect(shares.length).toBe(nets.length);
  expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(discount);

  for (let index = 0; index < nets.length; index += 1) {
    expect(shares[index] >= 0n).toBe(true);
    expect(shares[index] <= nets[index]).toBe(true);

    if (nets[index] === 0n) {
      expect(shares[index]).toBe(0n);
    }
  }
};

describe('document discount allocation', () => {
  it('allocates proportionally with capacity-safe remainder', () => {
    const nets = [700n, 300n];
    const shares = unwrap(allocateDocumentDiscount(
      nets.map((netAfterLineDiscountMicros) => ({
        netAfterLineDiscountMicros,
      })),
      100n,
    ));

    assertAllocationInvariants(nets, 100n, shares);
    expect(shares[0]).toBe(70n);
    expect(shares[1]).toBe(30n);
  });

  it('never over-allocates a small last line when remainder would overflow', () => {
    // Classic bug: dump all remainder on the last line. Capacity-safe Hamilton
    // must keep every share <= net and still sum to discount.
    const nets = [1_000n, 1n, 1n];
    const discount = 3n;
    const shares = unwrap(
      allocateDocumentDiscount(
        nets.map((netAfterLineDiscountMicros) => ({
          netAfterLineDiscountMicros,
        })),
        discount,
      ),
    );

    assertAllocationInvariants(nets, discount, shares);
  });

  it('gives zero-net lines no share', () => {
    const nets = [100n, 0n, 100n];
    const discount = 50n;
    const shares = unwrap(
      allocateDocumentDiscount(
        nets.map((netAfterLineDiscountMicros) => ({
          netAfterLineDiscountMicros,
        })),
        discount,
      ),
    );

    assertAllocationInvariants(nets, discount, shares);
    expect(shares[1]).toBe(0n);
  });

  it('allocates 100% document discount exactly to capacity', () => {
    const nets = [40n, 60n];
    const discount = 100n;
    const shares = unwrap(
      allocateDocumentDiscount(
        nets.map((netAfterLineDiscountMicros) => ({
          netAfterLineDiscountMicros,
        })),
        discount,
      ),
    );

    assertAllocationInvariants(nets, discount, shares);
    expect(shares).toEqual([40n, 60n]);
  });

  it('handles tiny micros without negative or over-capacity shares', () => {
    const nets = [1n, 1n, 1n];
    const discount = 2n;
    const shares = unwrap(
      allocateDocumentDiscount(
        nets.map((netAfterLineDiscountMicros) => ({
          netAfterLineDiscountMicros,
        })),
        discount,
      ),
    );

    assertAllocationInvariants(nets, discount, shares);
  });

  it('is reproducible for the same line order', () => {
    const lines = [
      { netAfterLineDiscountMicros: 333n },
      { netAfterLineDiscountMicros: 333n },
      { netAfterLineDiscountMicros: 334n },
    ];
    const first = unwrap(allocateDocumentDiscount(lines, 100n));
    const second = unwrap(allocateDocumentDiscount(lines, 100n));

    expect(first).toEqual(second);
    assertAllocationInvariants(
      lines.map((line) => line.netAfterLineDiscountMicros),
      100n,
      first,
    );
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
  it('keeps tax policy-pure and stores independent rounding', () => {
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

    const expectedTax = finalized.lines.reduce(
      (sum, line) =>
        sum + applyBasisPoints(line.netMicros, taxPolicy.rateBasisPoints),
      0n,
    );

    expect(finalized.totals.taxMicros).toBe(expectedTax);
    expect(isWholeRialMicros(finalized.totals.totalMicros)).toBe(true);
    expect(finalized.totals.totalMicros).toBe(
      finalized.totals.netMicros +
        finalized.totals.taxMicros +
        finalized.totals.roundingMicros,
    );
    expect(finalized.totals.netMicros).toBe(
      finalized.totals.grossMicros - finalized.totals.discountMicros,
    );
  });

  // The payable invariant is expressed on the combined figure: the split policy (6% tax +
  // 3% duty) must not change what the customer owes, only how the destination books it.
  it('splits a 9% policy into 6% tax and 3% duty without changing the payable', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'NONE' },
        taxRateBasisPoints: 600n,
        dutyRateBasisPoints: 300n,
      }),
    );

    expect(finalized.totals.taxOnlyMicros).toBe(60_000n * MICROS_PER_UNIT);
    expect(finalized.totals.dutyMicros).toBe(30_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxMicros).toBe(90_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxMicros).toBe(
      finalized.totals.taxOnlyMicros + finalized.totals.dutyMicros,
    );
    expect(finalized.totals.totalMicros).toBe(
      finalized.totals.netMicros +
        finalized.totals.taxMicros +
        finalized.totals.roundingMicros,
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
    // tax 9% → 72_900, total 882_900 whole rial, rounding 0
    expect(finalized.totals.grossMicros).toBe(1_000_000n * MICROS_PER_UNIT);
    expect(finalized.totals.lineDiscountMicros).toBe(100_000n * MICROS_PER_UNIT);
    expect(finalized.totals.documentDiscountMicros).toBe(
      90_000n * MICROS_PER_UNIT,
    );
    expect(finalized.totals.netMicros).toBe(810_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxMicros).toBe(72_900n * MICROS_PER_UNIT);
    expect(finalized.totals.roundingMicros).toBe(0n);
    expect(finalized.totals.totalMicros).toBe(882_900n * MICROS_PER_UNIT);
  });

  it('records a positive rounding adjustment without mutating tax', () => {
    // 1 micros net * 9% bp → tax = 0 (floor via basis points), but use a net
    // that leaves a fractional payable needing whole-rial floor.
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1n,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'NONE' },
        taxRateBasisPoints: 900n,
      }),
    );

    const pureTax = applyBasisPoints(line.netAfterLineDiscountMicros, 900n);

    expect(finalized.totals.taxMicros).toBe(pureTax);
    expect(finalized.lines[0].taxMicros).toBe(pureTax);

    const raw = finalized.totals.netMicros + finalized.totals.taxMicros;
    const expectedRounding = roundMicrosToWholeRial(raw) - raw;

    expect(finalized.totals.roundingMicros).toBe(expectedRounding);
    expect(finalized.totals.totalMicros).toBe(raw + expectedRounding);
    expect(isWholeRialMicros(finalized.totals.totalMicros)).toBe(true);
  });

  it('records a negative rounding adjustment when floor drops a fraction', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_499_999n,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'NONE' },
        taxRateBasisPoints: 0n,
      }),
    );

    expect(finalized.totals.taxMicros).toBe(0n);
    expect(finalized.totals.totalMicros).toBe(1_000_000n);
    expect(finalized.totals.roundingMicros).toBe(-499_999n);
    expect(isWholeRialMicros(finalized.totals.totalMicros)).toBe(true);
  });

  it('floors a payable above .5 rial instead of rounding half-up', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_900_000n,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'NONE' },
        taxRateBasisPoints: 0n,
      }),
    );

    expect(finalized.totals.totalMicros).toBe(1_000_000n);
    expect(finalized.totals.roundingMicros).toBe(-900_000n);
  });

  it('keeps tax at zero when the rate is zero', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 10_000n * MICROS_PER_UNIT,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'NONE' },
        taxRateBasisPoints: 0n,
      }),
    );

    expect(finalized.totals.taxMicros).toBe(0n);
    expect(finalized.totals.roundingMicros).toBe(0n);
    expect(finalized.totals.totalMicros).toBe(finalized.totals.netMicros);
  });

  // WS3: independent per-line rates after Hamilton document-discount allocation.
  it('applies distinct tax and duty rates per line after document discount', () => {
    const lineA = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'RATE', basisPoints: 1_000n },
      }),
    );
    const lineB = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 1_000_000n * MICROS_PER_UNIT,
        discount: { kind: 'NONE' },
      }),
    );

    // After line discounts: A=900_000, B=1_000_000; sum nets=1_900_000
    // Document 10% → 190_000; Hamilton shares: A=90_000, B=100_000
    // Taxable nets: A=810_000, B=900_000
    // A: tax 9% + duty 0% → 72_900; B: tax 6% + duty 3% → 54_000 + 27_000 = 81_000
    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [lineA, lineB],
        documentDiscount: { kind: 'RATE', basisPoints: 1_000n },
        taxRateBasisPoints: 900n,
        dutyRateBasisPoints: 0n,
        lineTaxRates: [
          { taxRateBasisPoints: 900n, dutyRateBasisPoints: 0n },
          { taxRateBasisPoints: 600n, dutyRateBasisPoints: 300n },
        ],
      }),
    );

    expect(finalized.lines[0].documentDiscountMicros).toBe(
      90_000n * MICROS_PER_UNIT,
    );
    expect(finalized.lines[1].documentDiscountMicros).toBe(
      100_000n * MICROS_PER_UNIT,
    );
    expect(finalized.lines[0].netMicros).toBe(810_000n * MICROS_PER_UNIT);
    expect(finalized.lines[1].netMicros).toBe(900_000n * MICROS_PER_UNIT);
    expect(finalized.lines[0].taxOnlyMicros).toBe(72_900n * MICROS_PER_UNIT);
    expect(finalized.lines[0].dutyMicros).toBe(0n);
    expect(finalized.lines[1].taxOnlyMicros).toBe(54_000n * MICROS_PER_UNIT);
    expect(finalized.lines[1].dutyMicros).toBe(27_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxOnlyMicros).toBe(126_900n * MICROS_PER_UNIT);
    expect(finalized.totals.dutyMicros).toBe(27_000n * MICROS_PER_UNIT);
    expect(finalized.totals.taxMicros).toBe(153_900n * MICROS_PER_UNIT);
    expect(finalized.totals.netMicros).toBe(1_710_000n * MICROS_PER_UNIT);
    expect(isWholeRialMicros(finalized.totals.totalMicros)).toBe(true);
    expect(finalized.totals.totalMicros).toBe(
      finalized.totals.netMicros +
        finalized.totals.taxMicros +
        finalized.totals.roundingMicros,
    );
  });

  it('supports 100% document discount with zero tax and payable', () => {
    const line = unwrap(
      computeLinePreTaxAmounts({
        quantityScaled: 1_000_000n,
        unitPriceMicros: 50_000n * MICROS_PER_UNIT,
        discount: { kind: 'NONE' },
      }),
    );

    const finalized = unwrap(
      finalizeLinesWithDocumentDiscount({
        preTaxLines: [line],
        documentDiscount: { kind: 'RATE', basisPoints: 10_000n },
        taxRateBasisPoints: 900n,
      }),
    );

    expect(finalized.totals.documentDiscountMicros).toBe(
      50_000n * MICROS_PER_UNIT,
    );
    expect(finalized.totals.netMicros).toBe(0n);
    expect(finalized.totals.taxMicros).toBe(0n);
    expect(finalized.totals.roundingMicros).toBe(0n);
    expect(finalized.totals.totalMicros).toBe(0n);
  });
});

describe('whole rial payable', () => {
  it('floors toward −∞ to a whole rial', () => {
    expect(roundMicrosToWholeRial(1_900_000n)).toBe(1_000_000n);
    expect(roundMicrosToWholeRial(1_100_000n)).toBe(1_000_000n);
    expect(roundMicrosToWholeRial(1_000_000n)).toBe(1_000_000n);
    expect(roundMicrosToWholeRial(0n)).toBe(0n);
    // Explicit negative contract (not used by quotations today).
    expect(roundMicrosToWholeRial(-1_100_000n)).toBe(-2_000_000n);
    expect(roundMicrosToWholeRial(-2_000_000n)).toBe(-2_000_000n);
  });
});

describe('tax policy registry', () => {
  it('resolves the existing IR_VAT_9 policy only', () => {
    expect(unwrap(resolveTaxPolicy('IR_VAT_9')).rateBasisPoints).toBe(900n);
    expect(resolveTaxPolicy('IR_VAT_10').ok).toBe(false);
  });
});
