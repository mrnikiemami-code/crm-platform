import { formatBasisPointsAsPersianPercent } from 'src/modules/quotation/utils/quotation-pdf-display.util';

describe('formatBasisPointsAsPersianPercent', () => {
  it('formats a whole percentage without a fraction', () => {
    expect(formatBasisPointsAsPersianPercent('900')).toBe('۹');
    expect(formatBasisPointsAsPersianPercent('0')).toBe('۰');
    expect(formatBasisPointsAsPersianPercent('10000')).toBe('۱۰۰');
  });

  it('keeps the fraction digits of a decimal rate', () => {
    expect(formatBasisPointsAsPersianPercent('1050')).toBe('۱۰٫۵');
    expect(formatBasisPointsAsPersianPercent('1025')).toBe('۱۰٫۲۵');
    expect(formatBasisPointsAsPersianPercent('950')).toBe('۹٫۵');
  });

  it('refuses a value that is not a stored basis-point count', () => {
    expect(formatBasisPointsAsPersianPercent(null)).toBeNull();
    expect(formatBasisPointsAsPersianPercent(undefined)).toBeNull();
    expect(formatBasisPointsAsPersianPercent('')).toBeNull();
    expect(formatBasisPointsAsPersianPercent('9.5')).toBeNull();
    expect(formatBasisPointsAsPersianPercent('-900')).toBeNull();
    expect(formatBasisPointsAsPersianPercent('10%')).toBeNull();
  });
});
