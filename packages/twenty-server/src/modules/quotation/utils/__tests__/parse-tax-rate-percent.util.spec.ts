import {
  formatBasisPointsAsPercent,
  parseTaxRatePercent,
} from 'src/modules/quotation/utils/parse-tax-rate-percent.util';

describe('parseTaxRatePercent', () => {
  it.each([
    ['9', '900'],
    ['۹', '900'],
    ['10', '1000'],
    ['۱۰٫۵', '1050'],
    ['10.5', '1050'],
    ['0', '0'],
    ['100', '10000'],
    ['10.55', '1055'],
  ])('parses %s into %s basis points', (text, expected) => {
    const outcome = parseTaxRatePercent(text);

    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.rateBasisPoints.toString()).toBe(expected);
  });

  it('refuses an empty rate', () => {
    expect(parseTaxRatePercent('  ')).toMatchObject({
      ok: false,
      code: 'TAX_RATE_REQUIRED',
    });
  });

  it('refuses a third fraction digit instead of rounding it', () => {
    expect(parseTaxRatePercent('10.555')).toMatchObject({
      ok: false,
      code: 'TAX_RATE_INVALID',
    });
  });

  it('refuses more than 100 percent', () => {
    expect(parseTaxRatePercent('101')).toMatchObject({
      ok: false,
      code: 'TAX_RATE_OUT_OF_RANGE',
    });
  });

  it('formats basis points back into the percent a person reads', () => {
    expect(formatBasisPointsAsPercent(BigInt(1050))).toBe('10.5');
    expect(formatBasisPointsAsPercent(BigInt(900))).toBe('9');
    expect(formatBasisPointsAsPercent(BigInt(0))).toBe('0');
  });
});
