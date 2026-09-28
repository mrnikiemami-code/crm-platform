import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { getIntlLocaleForAppLocale } from '@/localization/utils/getIntlLocaleForAppLocale';

describe('getIntlLocaleForAppLocale', () => {
  it('should resolve fa-IR to the persian calendar locale', () => {
    expect(getIntlLocaleForAppLocale('fa-IR')).toBe('fa-IR-u-ca-persian');
  });

  it('should keep Intl-supported non-fa locales', () => {
    expect(getIntlLocaleForAppLocale('fr-FR')).toBe('fr-FR');
    expect(getIntlLocaleForAppLocale('en')).toBe('en');
  });

  it('should fall back to the source locale instead of the host locale', () => {
    expect(getIntlLocaleForAppLocale('pseudo-en')).toBe('en');
    expect(getIntlLocaleForAppLocale(undefined)).toBe('en');
    expect(getIntlLocaleForAppLocale(null)).toBe('en');
  });
});

describe('formatDateTimeForAppLocale', () => {
  const date = new Date('2026-10-02T09:05:00Z');
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  };

  it('should format in the en app locale and requested timezone', () => {
    expect(
      formatDateTimeForAppLocale({
        date,
        locale: 'en',
        timeZone: 'UTC',
        options,
      }),
    ).toMatch(/^Oct 2, 2026, 9:05\sAM$/);
  });

  it('should format jalali text with persian digits for fa-IR', () => {
    expect(
      formatDateTimeForAppLocale({
        date,
        locale: 'fa-IR',
        timeZone: 'Asia/Tehran',
        options,
      }),
    ).toBe('۱۰ مهر ۱۴۰۵، ۱۲:۳۵');
  });

  it('should keep the gregorian calendar for other non-fa locales', () => {
    expect(
      formatDateTimeForAppLocale({
        date,
        locale: 'fr-FR',
        timeZone: 'UTC',
        options: { dateStyle: 'medium' },
      }),
    ).toBe('2 oct. 2026');
  });
});
