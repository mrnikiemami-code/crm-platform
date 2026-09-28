import { formatDateISOStringToCustomUnicodeFormat } from '@/localization/utils/formatDateISOStringToCustomUnicodeFormat';
import { DateFormat } from '@/localization/constants/DateFormat';
import { enUS, faIR } from 'date-fns/locale';

describe('formatDateISOStringToCustomUnicodeFormat', () => {
  describe('date-only ISO strings (no time component)', () => {
    it('should render with a year-only unicode format', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: 'yyyy',
        localeCatalog: enUS,
      });

      expect(result).toBe('2022');
    });

    it('should render with a custom day-month-year unicode format', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-03-14',
        timeZone: 'UTC',
        dateFormat: 'dd/MM/yyyy',
        localeCatalog: enUS,
      });

      expect(result).toBe('14/03/2022');
    });

    it('should render the same calendar date regardless of the user timezone', () => {
      const resultUtc = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: enUS,
      });
      const resultLA = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01',
        timeZone: 'America/Los_Angeles',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: enUS,
      });
      const resultTokyo = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01',
        timeZone: 'Asia/Tokyo',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: enUS,
      });

      expect(resultUtc).toBe('2022-01-01');
      expect(resultLA).toBe('2022-01-01');
      expect(resultTokyo).toBe('2022-01-01');
    });

    it('should preserve last day of the year in a positive offset timezone', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2024-12-31',
        timeZone: 'Asia/Tokyo',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: enUS,
      });

      expect(result).toBe('2024-12-31');
    });
  });

  describe('datetime ISO strings', () => {
    it('should render in the user timezone for a UTC value', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01T12:00:00Z',
        timeZone: 'UTC',
        dateFormat: 'yyyy-MM-dd HH:mm',
        localeCatalog: enUS,
      });

      expect(result).toBe('2022-01-01 12:00');
    });

    it('should shift the displayed date backward in negative-offset timezones', () => {
      // 2022-01-01 00:00 UTC = 2021-12-31 19:00 in America/New_York (UTC-5).
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01T00:00:00Z',
        timeZone: 'America/New_York',
        dateFormat: 'yyyy-MM-dd HH:mm',
        localeCatalog: enUS,
      });

      expect(result).toBe('2021-12-31 19:00');
    });

    it('should shift the displayed date forward in positive-offset timezones', () => {
      // 2022-01-01 22:00 UTC = 2022-01-02 07:00 in Asia/Tokyo (UTC+9).
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01T22:00:00Z',
        timeZone: 'Asia/Tokyo',
        dateFormat: 'yyyy-MM-dd HH:mm',
        localeCatalog: enUS,
      });

      expect(result).toBe('2022-01-02 07:00');
    });

    it('should return the fallback string for an unknown timezone', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2022-01-01T12:00:00Z',
        timeZone: 'Mars/Olympus',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: enUS,
      });

      expect(result).toBe('Invalid format string');
    });
  });

  // Custom formats are gregorian date-fns tokens, so the persian calendar falls
  // back to the user's standard date format instead of printing gregorian fields.
  describe('persian calendar fallback', () => {
    it('should ignore the custom pattern and use the fallback date format', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2026-09-28',
        timeZone: 'UTC',
        dateFormat: 'yyyy-MM-dd',
        localeCatalog: faIR,
        calendar: 'persian',
        fallbackDateFormat: DateFormat.MONTH_FIRST,
      });

      expect(result).toBe('مهر ۶، ۱۴۰۵');
    });

    it('should default the fallback to the day-first format', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2026-09-27T21:00:00Z',
        timeZone: 'Asia/Tehran',
        dateFormat: 'yyyy',
        localeCatalog: faIR,
        calendar: 'persian',
      });

      expect(result).toBe('۶ مهر ۱۴۰۵');
    });

    it('should never emit gregorian digits or years', () => {
      const result = formatDateISOStringToCustomUnicodeFormat({
        date: '2026-09-28T10:00:00Z',
        timeZone: 'UTC',
        dateFormat: 'yyyy-MM-dd HH:mm',
        localeCatalog: faIR,
        calendar: 'persian',
      });

      expect(result).not.toMatch(/[0-9]/);
      expect(result).not.toContain('۲۰۲۶');
    });
  });
});
