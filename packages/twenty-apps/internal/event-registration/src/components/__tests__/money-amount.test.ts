import { describe, expect, it } from 'vitest';

import {
  formatAmountForDisplay,
  formatTomanForDisplay,
  parseAmountInput,
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

describe('formatAmountForDisplay', () => {
  it('groups digits in threes from the right', () => {
    expect(formatAmountForDisplay('3900000')).toMatch(/^3\u066c900\u066c000$/);
  });

  it('groups 125000 as 125 thousand, not millions', () => {
    const formatted = formatAmountForDisplay('125000');

    expect(formatted).toMatch(/^125\u066c000$/);
    expect(formatted.replace(/\D/g, '')).toBe('125000');
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

describe('parseAmountInput — readable amounts', () => {
  it('reads 125,000 typed with Persian digits', () => {
    expect(parseAmountInput('۱۲۵۰۰۰')).toEqual({
      kind: 'AMOUNT',
      value: 125000,
    });
  });

  it('reads 125,000 typed with Persian digits and the Persian separator', () => {
    expect(parseAmountInput('۱۲۵\u066c۰۰۰')).toEqual({
      kind: 'AMOUNT',
      value: 125000,
    });
  });

  it('reads 125,000 typed with ASCII digits', () => {
    expect(parseAmountInput('125000')).toEqual({
      kind: 'AMOUNT',
      value: 125000,
    });
  });

  it('reads 125,000 typed with ASCII grouping', () => {
    expect(parseAmountInput('125,000')).toEqual({
      kind: 'AMOUNT',
      value: 125000,
    });
  });

  it('reads Arabic-Indic digits', () => {
    expect(parseAmountInput('١٢٥٠٠٠')).toEqual({
      kind: 'AMOUNT',
      value: 125000,
    });
  });

  it('reads a grouped amount', () => {
    expect(parseAmountInput('۳٬۹۰۰٬۰۰۰')).toEqual({
      kind: 'AMOUNT',
      value: 3900000,
    });
    expect(parseAmountInput('4,830,000')).toEqual({
      kind: 'AMOUNT',
      value: 4830000,
    });
  });

  it('reads a genuine zero', () => {
    expect(parseAmountInput('0')).toEqual({ kind: 'AMOUNT', value: 0 });
    expect(parseAmountInput('۰')).toEqual({ kind: 'AMOUNT', value: 0 });
  });

  it('reports an empty entry instead of zero', () => {
    expect(parseAmountInput('')).toEqual({ kind: 'EMPTY' });
    expect(parseAmountInput('   ')).toEqual({ kind: 'EMPTY' });
  });

  it('round-trips every formatted value', () => {
    for (const raw of ['0', '500', '3900000', '4830000', '19500000', '125000']) {
      expect(parseAmountInput(formatAmountForDisplay(raw))).toEqual({
        kind: 'AMOUNT',
        value: Number(raw),
      });
    }
  });
});

describe('parseAmountInput — unreadable amounts are refused, never rewritten', () => {
  // The incident: "125,000.00" used to lose the decimals into the amount and
  // become 12,500,000 — a hundredfold increase on a financial figure.
  it('refuses a decimal tail instead of multiplying the amount by 100', () => {
    expect(parseAmountInput('125000.00')).toEqual({
      kind: 'INVALID',
      reason: 'DECIMAL_NOT_ALLOWED',
    });
  });

  it('refuses a grouped decimal amount', () => {
    expect(parseAmountInput('125,000.00')).toEqual({
      kind: 'INVALID',
      reason: 'DECIMAL_NOT_ALLOWED',
    });
  });

  it('refuses a Persian decimal separator', () => {
    expect(parseAmountInput('۱۲۵\u066b۰۰۰')).toEqual({
      kind: 'INVALID',
      reason: 'DECIMAL_NOT_ALLOWED',
    });
  });

  it('refuses 12.5 instead of reading it as 125', () => {
    expect(parseAmountInput('12.5')).toEqual({
      kind: 'INVALID',
      reason: 'DECIMAL_NOT_ALLOWED',
    });
  });

  it('refuses letters instead of ignoring them', () => {
    expect(parseAmountInput('125000 ریال')).toEqual({
      kind: 'INVALID',
      reason: 'NOT_DIGITS',
    });
    expect(parseAmountInput('12.5m')).toEqual({
      kind: 'INVALID',
      reason: 'DECIMAL_NOT_ALLOWED',
    });
  });

  it('refuses a negative amount instead of dropping the sign', () => {
    expect(parseAmountInput('-125000')).toEqual({
      kind: 'INVALID',
      reason: 'NOT_DIGITS',
    });
  });

  it('refuses an amount beyond the safe integer range', () => {
    expect(parseAmountInput('99999999999999999999')).toEqual({
      kind: 'INVALID',
      reason: 'TOO_LARGE',
    });
  });

  it('never returns a number for an unreadable entry', () => {
    for (const raw of ['125000.00', '12.5', '-1', 'abc', '1e5']) {
      expect(parseAmountInput(raw).kind).not.toBe('AMOUNT');
    }
  });
});

describe('formatTomanForDisplay', () => {
  it('shows a stored amount in Persian digits', () => {
    expect(formatTomanForDisplay(125000)).toMatch(/^۱۲۵\u066c۰۰۰$/);
  });

  it('shows millions as millions', () => {
    expect(formatTomanForDisplay(12500000)).toMatch(/^۱۲\u066c۵۰۰\u066c۰۰۰$/);
  });
});
