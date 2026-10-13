import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';

// The digit formatter behind `useFormatDigitsForLocale` (phone numbers) and the
// Persian branch of `useNumberFormat`. Locked here so the "Persian digits in
// fa-IR" behavior cannot silently regress.
describe('formatDigitsAsPersian', () => {
  it('converts ASCII digits to Persian digits', () => {
    expect(formatDigitsAsPersian('09120000000')).toBe('۰۹۱۲۰۰۰۰۰۰۰');
    expect(formatDigitsAsPersian('+98 912 000 0000')).toBe(
      '+۹۸ ۹۱۲ ۰۰۰ ۰۰۰۰',
    );
  });

  it('leaves non-digit characters untouched', () => {
    expect(formatDigitsAsPersian('+98 (912)')).toBe('+۹۸ (۹۱۲)');
  });

  it('normalizes already-localized digits instead of double-converting', () => {
    // Persian and Arabic-Indic inputs both normalize to ASCII then to Persian.
    expect(formatDigitsAsPersian('۰۹۱۲')).toBe('۰۹۱۲');
    expect(formatDigitsAsPersian('٠٩١٢')).toBe('۰۹۱۲');
  });

  it('is a no-op for a string with no digits', () => {
    expect(formatDigitsAsPersian('SMS')).toBe('SMS');
  });
});
