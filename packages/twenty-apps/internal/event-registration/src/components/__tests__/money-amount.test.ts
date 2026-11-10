import { describe, expect, it } from 'vitest';

import {
  extractDigits,
  formatAmountForDisplay,
  parseAmountToNumber,
  toAsciiDigits,
} from 'src/components/money-amount';

describe('toAsciiDigits', () => {
  it('converts Persian digits', () => {
    expect(toAsciiDigits('۳۹۰۰۰۰۰')).toBe('3900000');
  });

  it('converts Arabic-Indic digits', () => {
    expect(toAsciiDigits('٤٨٣٠٠٠٠')).toBe('4830000');
  });

  it('leaves ASCII digits and separators alone', () => {
    expect(toAsciiDigits('1,234')).toBe('1,234');
  });
});

describe('extractDigits', () => {
  it('drops separators and stray characters', () => {
    expect(extractDigits('۳٬۹۰۰٬۰۰۰')).toBe('3900000');
    expect(extractDigits('1,234,567')).toBe('1234567');
    expect(extractDigits('۱۲۳ abc')).toBe('123');
  });

  it('returns an empty string when there are no digits', () => {
    expect(extractDigits('')).toBe('');
    expect(extractDigits('تومان')).toBe('');
  });
});

describe('formatAmountForDisplay', () => {
  it('groups digits in threes from the right', () => {
    expect(formatAmountForDisplay('3900000')).toMatch(/^3\u066c900\u066c000$/);
  });

  it('produces groups that read correctly', () => {
    // Assert on the digit groups rather than the exact separator codepoint.
    const formatted = formatAmountForDisplay('4830000');
    expect(formatted.replace(/\D/g, '')).toBe('4830000');
    expect(formatted).toMatch(/^4\u066c830\u066c000$/);
  });

  it('keeps a short amount ungrouped', () => {
    expect(formatAmountForDisplay('500')).toBe('500');
  });

  it('keeps an empty entry empty instead of showing zero', () => {
    expect(formatAmountForDisplay('')).toBe('');
  });

  it('preserves a genuine zero', () => {
    expect(formatAmountForDisplay('0')).toBe('0');
  });

  it('re-formats an already formatted value without doubling separators', () => {
    const once = formatAmountForDisplay('1234567');
    const twice = formatAmountForDisplay(once);

    expect(twice).toBe(once);
  });

  it('normalises Persian digits that the user typed', () => {
    const formatted = formatAmountForDisplay('۳۹۰۰۰۰۰');

    expect(formatted.replace(/\D/g, '')).toBe('3900000');
  });

  it('drops leading zeros on a longer number', () => {
    expect(formatAmountForDisplay('0007')).toBe('7');
  });
});

describe('parseAmountToNumber', () => {
  it('returns a plain integer from a grouped value', () => {
    expect(parseAmountToNumber('۳٬۹۰۰٬۰۰۰')).toBe(3900000);
    expect(parseAmountToNumber('4,830,000')).toBe(4830000);
  });

  it('returns 0 for a genuine zero', () => {
    expect(parseAmountToNumber('0')).toBe(0);
    expect(parseAmountToNumber('۰')).toBe(0);
  });

  it('returns null for an empty entry', () => {
    expect(parseAmountToNumber('')).toBeNull();
    expect(parseAmountToNumber('   ')).toBeNull();
  });

  it('round-trips every formatted value', () => {
    for (const raw of ['0', '500', '3900000', '4830000', '19500000']) {
      expect(parseAmountToNumber(formatAmountForDisplay(raw))).toBe(Number(raw));
    }
  });
});
