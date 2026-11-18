import { describe, expect, it } from 'vitest';

import {
  checkTotalsFitApiBoundary,
  computeDocumentTotals,
} from 'src/domain/money/document-totals';
import {
  computeLineAmounts,
  type LineDiscount,
  type QuotationLineAmounts,
} from 'src/domain/money/line';
import { API_SAFE_MICROS_LIMIT } from 'src/domain/money/micros';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const amountsFor = (input: {
  quantityMilli: bigint;
  unitPriceMicros: bigint;
  discount?: LineDiscount;
  taxRateBasisPoints?: bigint;
}): QuotationLineAmounts =>
  unwrap(
    computeLineAmounts({
      quantityMilli: input.quantityMilli,
      unitPriceMicros: input.unitPriceMicros,
      discount: input.discount ?? { kind: 'NONE' },
      taxRateBasisPoints: input.taxRateBasisPoints ?? 0n,
    }),
  );

describe('line amounts', () => {
  it('multiplies a decimal quantity by a unit price exactly', () => {
    // 12 units at 2,450,000 rial = 29,400,000 rial.
    const amounts = amountsFor({
      quantityMilli: 12_000n,
      unitPriceMicros: 2_450_000_000_000n,
    });

    expect(amounts.grossMicros).toBe(29_400_000_000_000n);
    expect(amounts.netMicros).toBe(29_400_000_000_000n);
    expect(amounts.totalMicros).toBe(29_400_000_000_000n);
  });

  it('handles a fractional quantity without drifting', () => {
    // 2.5 hours at 1,000,000 rial = 2,500,000 rial, not 2,500,000.000001.
    const amounts = amountsFor({
      quantityMilli: 2_500n,
      unitPriceMicros: 1_000_000_000_000n,
    });

    expect(amounts.grossMicros).toBe(2_500_000_000_000n);
  });

  it('taxes the discounted amount, not the gross', () => {
    // 10,000,000 gross, 10% discount -> 9,000,000 net, 9% VAT -> 810,000 tax.
    const amounts = amountsFor({
      quantityMilli: 1_000n,
      unitPriceMicros: 10_000_000_000_000n,
      discount: { kind: 'RATE', basisPoints: 1_000n },
      taxRateBasisPoints: 900n,
    });

    expect(amounts.grossMicros).toBe(10_000_000_000_000n);
    expect(amounts.discountMicros).toBe(1_000_000_000_000n);
    expect(amounts.netMicros).toBe(9_000_000_000_000n);
    expect(amounts.taxMicros).toBe(810_000_000_000n);
    expect(amounts.totalMicros).toBe(9_810_000_000_000n);
  });

  it('treats a stated discount amount as authoritative', () => {
    const amounts = amountsFor({
      quantityMilli: 1_000n,
      unitPriceMicros: 5_000_000_000_000n,
      discount: { kind: 'AMOUNT', micros: 1_234_567n },
      taxRateBasisPoints: 900n,
    });

    expect(amounts.discountMicros).toBe(1_234_567n);
    expect(amounts.netMicros).toBe(5_000_000_000_000n - 1_234_567n);
    // 9% of 4,999,998,765,433 is 449,999,888,888.97 -> 449,999,888,889.
    expect(amounts.taxMicros).toBe(449_999_888_889n);
  });

  it('keeps total equal to net plus tax by construction', () => {
    const amounts = amountsFor({
      quantityMilli: 3_333n,
      unitPriceMicros: 777_777_777n,
      discount: { kind: 'RATE', basisPoints: 333n },
      taxRateBasisPoints: 900n,
    });

    expect(amounts.totalMicros).toBe(amounts.netMicros + amounts.taxMicros);
    expect(amounts.netMicros).toBe(amounts.grossMicros - amounts.discountMicros);
  });
});

describe('line refusals', () => {
  const refusalOf = (input: {
    quantityMilli: bigint;
    unitPriceMicros: bigint;
    discount?: LineDiscount;
    taxRateBasisPoints?: bigint;
  }): string => {
    const result = computeLineAmounts({
      quantityMilli: input.quantityMilli,
      unitPriceMicros: input.unitPriceMicros,
      discount: input.discount ?? { kind: 'NONE' },
      taxRateBasisPoints: input.taxRateBasisPoints ?? 0n,
    });

    return result.ok ? 'NO_REFUSAL' : result.refusal.code;
  };

  it('refuses a non-positive quantity', () => {
    expect(
      refusalOf({ quantityMilli: 0n, unitPriceMicros: 1_000_000n }),
    ).toBe('QUANTITY_NOT_POSITIVE');
  });

  it('refuses a negative unit price', () => {
    expect(
      refusalOf({ quantityMilli: 1_000n, unitPriceMicros: -1n }),
    ).toBe('UNIT_PRICE_NEGATIVE');
  });

  it('refuses a discount larger than the line instead of clamping it', () => {
    expect(
      refusalOf({
        quantityMilli: 1_000n,
        unitPriceMicros: 1_000_000n,
        discount: { kind: 'AMOUNT', micros: 2_000_000n },
      }),
    ).toBe('DISCOUNT_EXCEEDS_LINE');
  });

  it('refuses an out-of-range tax rate', () => {
    expect(
      refusalOf({
        quantityMilli: 1_000n,
        unitPriceMicros: 1_000_000n,
        taxRateBasisPoints: 10_001n,
      }),
    ).toBe('TAX_RATE_OUT_OF_RANGE');
  });
});

describe('document totals', () => {
  it('sums the rounded lines exactly, with no second rounding pass', () => {
    const lines = [
      amountsFor({
        quantityMilli: 1_000n,
        unitPriceMicros: 1_000_001n,
        taxRateBasisPoints: 900n,
      }),
      amountsFor({
        quantityMilli: 1_000n,
        unitPriceMicros: 1_000_003n,
        taxRateBasisPoints: 900n,
      }),
      amountsFor({
        quantityMilli: 1_000n,
        unitPriceMicros: 1_000_007n,
        taxRateBasisPoints: 900n,
      }),
    ];

    const totals = unwrap(computeDocumentTotals(lines));

    const sumOfLines = lines.reduce(
      (sum, line) => sum + line.totalMicros,
      0n,
    );

    expect(totals.totalMicros).toBe(sumOfLines);
    expect(totals.taxMicros).toBe(
      lines.reduce((sum, line) => sum + line.taxMicros, 0n),
    );
  });

  it('holds sum(lines) === total across many awkward line shapes', () => {
    // Deterministic pseudo-random shapes: a property test with a fixed seed, so a
    // failure is reproducible instead of a flaky surprise on CI.
    let seed = 20261118n;

    const next = (bound: bigint): bigint => {
      seed = (seed * 1_103_515_245n + 12_345n) % 2_147_483_647n;

      return seed % bound;
    };

    for (let round = 0; round < 50; round += 1) {
      const lines = Array.from({ length: 1 + Number(next(8n)) }, () => {
        const gross = 1n + next(9_000_000n);

        return amountsFor({
          quantityMilli: 1n + next(5_000n),
          unitPriceMicros: gross,
          discount:
            next(2n) === 0n
              ? { kind: 'RATE', basisPoints: next(1_000n) }
              : { kind: 'NONE' },
          taxRateBasisPoints: next(1_000n),
        });
      });

      const totals = unwrap(computeDocumentTotals(lines));

      expect(totals.totalMicros).toBe(
        lines.reduce((sum, line) => sum + line.totalMicros, 0n),
      );
      expect(totals.netMicros).toBe(
        totals.grossMicros - totals.discountMicros,
      );
      expect(totals.totalMicros).toBe(totals.netMicros + totals.taxMicros);
    }
  });

  it('refuses a quotation with no lines', () => {
    const result = computeDocumentTotals([]);

    expect(result.ok).toBe(false);
  });

  it('flags a total the currency field could not hold exactly', () => {
    const hugeLine = amountsFor({
      quantityMilli: 1_000_000n,
      unitPriceMicros: API_SAFE_MICROS_LIMIT,
    });
    const totals = unwrap(computeDocumentTotals([hugeLine]));

    const check = checkTotalsFitApiBoundary(totals);

    expect(check.ok).toBe(false);
    expect(check.ok ? 'NO_REFUSAL' : check.refusal.code).toBe(
      'AMOUNT_EXCEEDS_API_RANGE',
    );
  });
});
