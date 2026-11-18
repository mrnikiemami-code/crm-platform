import { describe, expect, it } from 'vitest';

import {
  BASIS_POINTS_PER_PERCENT,
  divideRoundHalfUp,
  applyBasisPoints,
} from 'src/domain/money/arithmetic';
import {
  API_SAFE_MICROS_LIMIT,
  MICROS_PER_UNIT,
  checkApiSafeMicros,
  formatMicrosExact,
  isApiSafeMicros,
  parseMicrosExact,
} from 'src/domain/money/micros';
import {
  formatQuantityMilli,
  parseQuantityMilli,
  QUANTITY_SCALE,
} from 'src/domain/money/quantity';

const unwrap = <TValue>(result: { ok: true; value: TValue } | { ok: false }): TValue => {
  if (!result.ok) {
    throw new Error('expected a successful result');
  }

  return result.value;
};

const refusalCodeOf = (result: { ok: boolean } & Record<string, unknown>): string => {
  const refusal = result.refusal as { code: string } | undefined;

  return refusal?.code ?? 'NO_REFUSAL';
};

describe('rounding', () => {
  it('rounds a half away from zero in both directions', () => {
    expect(divideRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divideRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(divideRoundHalfUp(5n, -2n)).toBe(-3n);
    expect(divideRoundHalfUp(-5n, -2n)).toBe(3n);
  });

  it('leaves values below the half untouched', () => {
    expect(divideRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divideRoundHalfUp(5n, 3n)).toBe(2n);
    expect(divideRoundHalfUp(1n, 3n)).toBe(0n);
  });

  it('is exact where a double is not', () => {
    // 0.1 + 0.2 in doubles is 0.30000000000000004; as scaled integers it is exact,
    // which is the whole reason the domain runs on bigint.
    const tenth = 100_000n;
    const fifth = 200_000n;

    expect(tenth + fifth).toBe(300_000n);
    expect(divideRoundHalfUp(tenth + fifth, 3n)).toBe(100_000n);
  });

  it('refuses a zero denominator instead of returning infinity', () => {
    expect(() => divideRoundHalfUp(1n, 0n)).toThrow(
      'denominator must not be zero',
    );
  });
});

describe('basis points', () => {
  it('applies a percentage without floating point', () => {
    const oneUnit = MICROS_PER_UNIT;

    expect(applyBasisPoints(oneUnit, 900n)).toBe(90_000n);
    expect(applyBasisPoints(oneUnit, BASIS_POINTS_PER_PERCENT * 100n)).toBe(
      oneUnit,
    );
  });

  it('rounds the tax to a whole micro', () => {
    // 9% of 3 micros is 0.27 micros; a document cannot carry a fraction of a micro.
    expect(applyBasisPoints(3n, 900n)).toBe(0n);
    expect(applyBasisPoints(6n, 900n)).toBe(1n);
  });
});

describe('amounts as micros', () => {
  it('formats an exact decimal that never loses a digit', () => {
    expect(formatMicrosExact(1_500_000n)).toBe('1.500000');
    expect(formatMicrosExact(0n)).toBe('0.000000');
    expect(formatMicrosExact(-2_000_001n)).toBe('-2.000001');
  });

  it('parses a decimal back to the same micros', () => {
    for (const micros of [0n, 1n, 999_999n, 1_000_000n, 12_345_678_901n]) {
      expect(unwrap(parseMicrosExact(formatMicrosExact(micros)))).toBe(micros);
    }
  });

  it('refuses a seventh decimal digit instead of rounding it away', () => {
    const result = parseMicrosExact('1.0000001');

    expect(result.ok).toBe(false);
    expect(refusalCodeOf(result)).toBe('AMOUNT_NOT_A_DECIMAL');
  });

  it('refuses text that is not a number', () => {
    expect(parseMicrosExact('').ok).toBe(false);
    expect(parseMicrosExact('12,5').ok).toBe(false);
    expect(parseMicrosExact('1e6').ok).toBe(false);
  });

  it('marks the exact boundary of what the API can persist', () => {
    expect(API_SAFE_MICROS_LIMIT).toBe(9_007_199_254_740_991n);
    expect(isApiSafeMicros(API_SAFE_MICROS_LIMIT)).toBe(true);
    expect(isApiSafeMicros(API_SAFE_MICROS_LIMIT + 1n)).toBe(false);
    expect(isApiSafeMicros(-API_SAFE_MICROS_LIMIT)).toBe(true);
    expect(isApiSafeMicros(-API_SAFE_MICROS_LIMIT - 1n)).toBe(false);
  });

  it('refuses an amount the currency field would silently change', () => {
    // The loss is real and easy to see: two micros above the safe limit, the value
    // that comes back out of a JS number is a different integer.
    const unrepresentable = API_SAFE_MICROS_LIMIT + 2n;

    expect(BigInt(Number(unrepresentable))).not.toBe(unrepresentable);
    expect(checkApiSafeMicros(API_SAFE_MICROS_LIMIT, 'total').ok).toBe(true);

    const refused = checkApiSafeMicros(unrepresentable, 'total');

    expect(refused.ok).toBe(false);
    expect(refusalCodeOf(refused)).toBe('AMOUNT_EXCEEDS_API_RANGE');
  });
});

describe('quantities', () => {
  it('reads a decimal quantity into milli-units', () => {
    expect(unwrap(parseQuantityMilli('12'))).toBe(12n * QUANTITY_SCALE);
    expect(unwrap(parseQuantityMilli('1.5'))).toBe(1500n);
    expect(unwrap(parseQuantityMilli('0.001'))).toBe(1n);
  });

  it('reads a Persian keyboard entry', () => {
    expect(unwrap(parseQuantityMilli('۱٫۵'))).toBe(1500n);
    expect(unwrap(parseQuantityMilli('۱٬۲۰۰'))).toBe(1_200_000n);
    expect(unwrap(parseQuantityMilli('٢.٥'))).toBe(2500n);
  });

  it('refuses a fourth decimal digit rather than truncating it', () => {
    const result = parseQuantityMilli('1.2345');

    expect(result.ok).toBe(false);
    expect(refusalCodeOf(result)).toBe('QUANTITY_NOT_A_DECIMAL');
  });

  it('refuses a negative or empty quantity', () => {
    expect(parseQuantityMilli('-1').ok).toBe(false);
    expect(parseQuantityMilli('').ok).toBe(false);
    expect(parseQuantityMilli('abc').ok).toBe(false);
  });

  it('round trips through the display form', () => {
    for (const text of ['1', '1.5', '0.001', '1200', '12.25']) {
      expect(formatQuantityMilli(unwrap(parseQuantityMilli(text)))).toBe(text);
    }
  });
});
