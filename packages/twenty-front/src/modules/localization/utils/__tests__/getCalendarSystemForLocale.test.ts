import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { APP_LOCALES } from 'twenty-shared/translations';

describe('getCalendarSystemForLocale', () => {
  it('should resolve fa-IR to the persian calendar', () => {
    expect(getCalendarSystemForLocale('fa-IR')).toBe('persian');
  });

  it('should resolve en to the gregorian calendar', () => {
    expect(getCalendarSystemForLocale('en')).toBe('gregory');
  });

  it.each(Object.keys(APP_LOCALES).filter((locale) => locale !== 'fa-IR'))(
    'should resolve %s to the gregorian calendar',
    (locale) => {
      expect(getCalendarSystemForLocale(locale)).toBe('gregory');
    },
  );

  it('should fall back to the gregorian calendar for missing locales', () => {
    expect(getCalendarSystemForLocale(undefined)).toBe('gregory');
    expect(getCalendarSystemForLocale(null)).toBe('gregory');
    expect(getCalendarSystemForLocale('')).toBe('gregory');
  });

  it('should only match the exact fa-IR app locale', () => {
    expect(getCalendarSystemForLocale('fa')).toBe('gregory');
    expect(getCalendarSystemForLocale('ar-SA')).toBe('gregory');
  });
});
