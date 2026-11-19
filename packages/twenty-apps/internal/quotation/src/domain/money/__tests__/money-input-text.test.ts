import { describe, expect, it } from 'vitest';

import { parseMoneyInput } from 'src/domain/money/currency';
import {
  assertMoneyInputRoundTrip,
  formatMicrosForPeopleInput,
} from 'src/domain/money/input-amount';
import {
  applyMoneyInputChange,
  formatAsciiCompactForPeopleInput,
  normalizeMoneyFigureText,
  toPersianDigits,
} from 'src/domain/money/money-input-text';
import { MICROS_PER_UNIT } from 'src/domain/money/micros';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(result.refusal.code);
  }

  return result.value;
};

describe('money input parse contract', () => {
  it('accepts the required valid figures', () => {
    expect(unwrap(parseMoneyInput('۱٬۲۰۰٬۰۰۰', 'IRR')).irrMicros).toBe(
      1_200_000n * MICROS_PER_UNIT,
    );
    expect(unwrap(parseMoneyInput('1,200,000', 'IRR')).irrMicros).toBe(
      1_200_000n * MICROS_PER_UNIT,
    );
    expect(unwrap(parseMoneyInput('۱٬۲۰۰٫۵', 'IRR')).irrMicros).toBe(
      1_200n * MICROS_PER_UNIT + 500_000n,
    );
    expect(unwrap(parseMoneyInput('1,200.50', 'IRR')).irrMicros).toBe(
      1_200n * MICROS_PER_UNIT + 500_000n,
    );
    expect(unwrap(parseMoneyInput('۱۲۳۴۵۶۷', 'IRR')).irrMicros).toBe(
      1_234_567n * MICROS_PER_UNIT,
    );
  });

  it('refuses invalid grouping and ambiguous decimals', () => {
    expect(parseMoneyInput('1,20,000', 'IRR').ok).toBe(false);
    expect(parseMoneyInput('۱٬۲۳٫۴', 'IRR').ok).toBe(false);
    expect(parseMoneyInput('1,200.5.6', 'IRR').ok).toBe(false);
  });

  it('keeps parse(format(value)) === value', () => {
    const samples = [
      '1200000',
      '1,200,000',
      '۱٬۲۰۰٬۰۰۰',
      '1200.5',
      '1,200.50',
      '0.000001',
      '109003.3',
    ];

    for (const sample of samples) {
      expect(assertMoneyInputRoundTrip(sample).ok).toBe(true);
    }
  });

  it('formats autofill with Persian thousands', () => {
    expect(
      unwrap(formatMicrosForPeopleInput(120_000_000n * MICROS_PER_UNIT, 'IRR')),
    ).toBe('۱۲۰٬۰۰۰٬۰۰۰');
  });

  it('preserves digit-relative caret when inserting separators', () => {
    const next = applyMoneyInputChange({
      nextRawText: '1200000',
      caretIndex: 7,
    });

    expect(next.displayText).toBe('۱٬۲۰۰٬۰۰۰');
    expect(next.caretIndex).toBe(next.displayText.length);
  });
});

describe('money input property-based round trip', () => {
  it('holds for large, zero, fractional, and mixed-script figures', () => {
    const seeds = [
      0n,
      1n,
      999n,
      1_000n,
      12_345_678n,
      10n ** 12n,
      10n ** 14n,
    ];
    const fractions = [0, 1, 27, 500_000, 999_999];
    const scripts = ['ascii', 'persian', 'arabic'] as const;

    for (const units of seeds) {
      for (const fractionInt of fractions) {
        for (const script of scripts) {
          const fraction = fractionInt.toString().padStart(6, '0');
          const asciiCompact =
            fraction === '000000'
              ? units.toString()
              : `${units}.${fraction.replace(/0+$/, '')}`;

          const people = formatAsciiCompactForPeopleInput(asciiCompact);
          const [integerAscii, fractionAscii] = asciiCompact.split('.');
          const asciiGrouped =
            integerAscii.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
            (fractionAscii === undefined ? '' : `.${fractionAscii}`);
          const mixed =
            script === 'ascii'
              ? asciiGrouped
              : script === 'arabic'
                ? people.replace(/[۰-۹]/g, (digit) => {
                    const index = '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);

                    return index >= 0 ? '٠١٢٣٤٥٦٧٨٩'[index] : digit;
                  })
                : people;

          const again = unwrap(normalizeMoneyFigureText(mixed));

          expect(again.trailingDecimal).toBe(false);
          expect(again.asciiCompact).toBe(asciiCompact);
          expect(assertMoneyInputRoundTrip(mixed).ok).toBe(true);
          expect(toPersianDigits('12')).toBe('۱۲');
        }
      }
    }
  });
});
