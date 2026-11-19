import { describe, expect, it } from 'vitest';

import {
  BASIS_POINTS_PER_PERCENT,
  applyBasisPoints,
  divideRoundHalfUp,
} from 'src/domain/money/arithmetic';
import {
  formatMoneyForDisplay,
  irrMicrosToTomanMicros,
  parseMoneyInput,
  tomanToIrrMicros,
  TOMAN_TO_IRR_RATIO,
} from 'src/domain/money/currency';
import {
  EXACT_NUMBER_LIMIT,
  MICROS_PER_UNIT,
  formatMicrosExact,
  formatMicrosSortable,
  isCanonicalMicrosText,
  isExactlyRepresentableAsNumber,
  parseMicrosExact,
  toExactNumberOrRefuse,
} from 'src/domain/money/micros';
import {
  formatQuantityExact,
  formatQuantityForDisplay,
  parseQuantity,
  QUANTITY_SCALE,
} from 'src/domain/money/quantity';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const refusalCodeOf = (result: {
  ok: boolean;
  refusal?: { code: string };
}): string => (result.ok ? 'NO_REFUSAL' : (result.refusal?.code ?? 'NONE'));

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
    expect(applyBasisPoints(MICROS_PER_UNIT, 900n)).toBe(90_000n);
    expect(applyBasisPoints(MICROS_PER_UNIT, BASIS_POINTS_PER_PERCENT * 100n)).toBe(
      MICROS_PER_UNIT,
    );
  });

  it('rounds the tax to a whole micro', () => {
    expect(applyBasisPoints(3n, 900n)).toBe(0n);
    expect(applyBasisPoints(6n, 900n)).toBe(1n);
  });
});

describe('exact amount as the single source of truth', () => {
  it('formats an exact decimal that never loses a digit', () => {
    expect(formatMicrosExact(1_500_000n)).toBe('1.500000');
    expect(formatMicrosExact(0n)).toBe('0.000000');
    expect(formatMicrosExact(-2_000_001n)).toBe('-2.000001');
  });

  it('round trips every value without loss', () => {
    for (const micros of [
      0n,
      1n,
      999_999n,
      1_000_000n,
      12_345_678_901n,
      // Deliberately far beyond 2^53: the point of the contract is that these survive.
      9_007_199_254_740_993n,
      123_456_789_012_345_678_901n,
      -9_007_199_254_740_993n,
    ]) {
      expect(unwrap(parseMicrosExact(formatMicrosExact(micros)))).toBe(micros);
    }
  });

  it('survives the trip a CURRENCY column would not', () => {
    // The whole reason the contract stores text: this amount comes back from a JSON number
    // as a DIFFERENT integer, and no amount of care at the call site fixes it.
    const amount = 9_007_199_254_740_993n;

    expect(BigInt(Number(amount))).not.toBe(amount);
    // Through the text form, it is unchanged.
    expect(unwrap(parseMicrosExact(formatMicrosExact(amount)))).toBe(amount);
  });

  it('refuses a seventh decimal digit instead of rounding it away', () => {
    expect(refusalCodeOf(parseMicrosExact('1.0000001'))).toBe(
      'AMOUNT_NOT_A_DECIMAL',
    );
  });

  it('refuses text that is not a number', () => {
    expect(parseMicrosExact('').ok).toBe(false);
    expect(parseMicrosExact('12,5').ok).toBe(false);
    expect(parseMicrosExact('1e6').ok).toBe(false);
  });

  it('accepts only one spelling as canonical', () => {
    expect(isCanonicalMicrosText('1.500000')).toBe(true);
    expect(isCanonicalMicrosText('1.5')).toBe(false);
    expect(isCanonicalMicrosText('01.500000')).toBe(false);
  });

  it('orders lexicographically exactly as the numbers order', () => {
    const values = [-2_000_000n, -1n, 0n, 1n, 999_999n, 1_000_000n, 10n ** 18n];
    const sortedNumbers = [...values].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    const sortedStrings = values
      .map(formatMicrosSortable)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

    expect(sortedStrings).toEqual(sortedNumbers.map(formatMicrosSortable));
    // Fixed width is what makes the text index usable as a sort key.
    expect(new Set(values.map(formatMicrosSortable).map((text) => text.length)).size).toBe(1);
  });

  it('refuses a display number that would change the value', () => {
    expect(isExactlyRepresentableAsNumber(EXACT_NUMBER_LIMIT)).toBe(true);
    expect(unwrap(toExactNumberOrRefuse(EXACT_NUMBER_LIMIT))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(refusalCodeOf(toExactNumberOrRefuse(EXACT_NUMBER_LIMIT + 2n))).toBe(
      'AMOUNT_NOT_EXACTLY_REPRESENTABLE',
    );
  });
});

describe('IRR canonical, toman at the boundary', () => {
  it('converts toman to rial by the fixed unit scale', () => {
    expect(TOMAN_TO_IRR_RATIO).toBe(10n);
    // 125,000 toman is 1,250,000 rial.
    expect(tomanToIrrMicros(125_000_000_000n)).toBe(1_250_000_000_000n);
  });

  it('reads a Persian toman entry into rials', () => {
    const parsed = unwrap(parseMoneyInput('۱۲۵٬۰۰۰', 'TOMAN'));

    // 125,000 toman = 1,250,000 rial = 1_250_000_000_000 micros.
    expect(parsed.irrMicros).toBe(1_250_000_000_000n);
    expect(parsed.unit).toBe('TOMAN');
  });

  it('reads a rial entry without scaling it', () => {
    expect(unwrap(parseMoneyInput('1250000', 'IRR')).irrMicros).toBe(
      1_250_000_000_000n,
    );
  });

  it('keeps six decimals of a toman entry', () => {
    expect(unwrap(parseMoneyInput('0.000001', 'TOMAN')).irrMicros).toBe(10n);
  });

  it('refuses an amount that would drop a fraction of a micro when shown in toman', () => {
    // A tenth of a rial converts exactly (micros are fine enough). What cannot convert is a
    // value finer than a tenth of a micro, where the division would lose the fraction.
    expect(unwrap(irrMicrosToTomanMicros(1_000_000n))).toBe(100_000n);
    expect(unwrap(irrMicrosToTomanMicros(10_000_000n))).toBe(1_000_000n);
    expect(refusalCodeOf(irrMicrosToTomanMicros(1n))).toBe(
      'AMOUNT_NOT_WHOLE_TOMAN',
    );
  });

  it('labels the unit on every rendered amount', () => {
    const inRial = unwrap(
      formatMoneyForDisplay({
        irrMicros: 1_250_000_000_000n,
        unit: 'IRR',
        formatExact: formatMicrosExact,
      }),
    );
    const inToman = unwrap(
      formatMoneyForDisplay({
        irrMicros: 1_250_000_000_000n,
        unit: 'TOMAN',
        formatExact: formatMicrosExact,
      }),
    );

    expect(inRial).toBe('1250000.000000 ریال');
    expect(inToman).toBe('125000.000000 تومان');
    // Exact storage form remains the default when formatPeople is omitted.
    // The two strings differ by the unit as well as the figure, so neither can be
    // misread as the other.
    expect(inRial).not.toBe(inToman);
  });

  it('refuses an empty or malformed amount', () => {
    expect(refusalCodeOf(parseMoneyInput('   ', 'TOMAN'))).toBe('AMOUNT_EMPTY');
    expect(refusalCodeOf(parseMoneyInput('12.3456789', 'IRR'))).toBe(
      'AMOUNT_NOT_A_DECIMAL',
    );
    expect(parseMoneyInput('-5', 'IRR').ok).toBe(false);
  });
});

describe('quantities to six decimals', () => {
  it('scales to a millionth', () => {
    expect(QUANTITY_SCALE).toBe(1_000_000n);
    expect(unwrap(parseQuantity('12'))).toBe(12_000_000n);
    expect(unwrap(parseQuantity('1.5'))).toBe(1_500_000n);
    expect(unwrap(parseQuantity('0.000001'))).toBe(1n);
  });

  it('accepts six decimals and refuses a seventh', () => {
    expect(unwrap(parseQuantity('1.234567'))).toBe(1_234_567n);
    expect(refusalCodeOf(parseQuantity('1.2345678'))).toBe(
      'QUANTITY_NOT_A_DECIMAL',
    );
  });

  it('reads a Persian keyboard entry', () => {
    expect(unwrap(parseQuantity('۱٫۵'))).toBe(1_500_000n);
    expect(unwrap(parseQuantity('۱٬۲۰۰'))).toBe(1_200_000_000n);
    expect(unwrap(parseQuantity('٢.٥'))).toBe(2_500_000n);
  });

  it('refuses a negative or empty quantity', () => {
    expect(parseQuantity('-1').ok).toBe(false);
    expect(parseQuantity('').ok).toBe(false);
    expect(parseQuantity('abc').ok).toBe(false);
  });

  it('stores a canonical form and displays a trimmed one', () => {
    expect(formatQuantityExact(1_500_000n)).toBe('1.500000');
    expect(formatQuantityExact(12_000_000n)).toBe('12.000000');
    expect(formatQuantityForDisplay(12_000_000n)).toBe('12');
    expect(formatQuantityForDisplay(1_500_000n)).toBe('1.5');
    expect(formatQuantityForDisplay(0n)).toBe('0');
  });
});
