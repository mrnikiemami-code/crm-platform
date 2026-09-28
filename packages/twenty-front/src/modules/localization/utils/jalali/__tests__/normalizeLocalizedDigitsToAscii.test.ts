import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';

describe('normalizeLocalizedDigitsToAscii', () => {
  it('should convert Persian digits to ASCII', () => {
    expect(normalizeLocalizedDigitsToAscii('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('should convert Arabic-Indic digits to ASCII', () => {
    expect(normalizeLocalizedDigitsToAscii('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('should normalize a Jalali date typed with Persian digits', () => {
    expect(normalizeLocalizedDigitsToAscii('۱۴۰۵/۰۷/۰۶')).toBe('1405/07/06');
  });

  it('should leave ASCII digits and other characters unchanged', () => {
    expect(normalizeLocalizedDigitsToAscii('2026-09-28 مهر abc')).toBe(
      '2026-09-28 مهر abc',
    );
  });

  it('should return an empty string unchanged', () => {
    expect(normalizeLocalizedDigitsToAscii('')).toBe('');
  });
});
