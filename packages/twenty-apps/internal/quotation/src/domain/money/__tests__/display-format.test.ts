import { describe, expect, it } from 'vitest';

import { formatMoneyForDisplay } from 'src/domain/money/currency';
import { formatExactDecimalForPeople } from 'src/domain/money/display-format';
import { formatMicrosExact, MICROS_PER_UNIT } from 'src/domain/money/micros';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(result.refusal.code);
  }

  return result.value;
};

describe('formatExactDecimalForPeople', () => {
  it('trims trailing zeros and groups with Persian digits', () => {
    expect(formatExactDecimalForPeople('100003.000000')).toBe('۱۰۰٬۰۰۳');
    expect(formatExactDecimalForPeople('9000.270000')).toBe('۹٬۰۰۰٫۲۷');
    expect(formatExactDecimalForPeople('109003.300000')).toBe('۱۰۹٬۰۰۳٫۳');
  });
});

describe('formatMoneyForDisplay with people formatter', () => {
  it('labels trimmed Persian figures', () => {
    const toman = unwrap(
      formatMoneyForDisplay({
        irrMicros: 100_003n * 10n * MICROS_PER_UNIT,
        unit: 'TOMAN',
        formatExact: formatMicrosExact,
        formatPeople: formatExactDecimalForPeople,
      }),
    );

    expect(toman).toBe('۱۰۰٬۰۰۳ تومان');
  });
});
