import { localizeDigitsForAppLocale } from '@/localization/utils/localizeDigitsForAppLocale';

describe('localizeDigitsForAppLocale', () => {
  it('should convert latin digits to Persian digits for fa-IR', () => {
    expect(localizeDigitsForAppLocale('8 years and 19 days', 'fa-IR')).toBe(
      '۸ years and ۱۹ days',
    );
  });

  it('should not add grouping separators', () => {
    expect(localizeDigitsForAppLocale('12345', 'fa-IR')).toBe('۱۲۳۴۵');
  });

  it.each(['en', 'fr-FR', 'ar-SA', undefined, null])(
    'should keep text unchanged for %s',
    (locale) => {
      expect(localizeDigitsForAppLocale('8 years and 19 days', locale)).toBe(
        '8 years and 19 days',
      );
    },
  );
});
