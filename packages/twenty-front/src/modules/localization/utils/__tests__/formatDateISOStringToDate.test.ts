import { DateFormat } from '@/localization/constants/DateFormat';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { enUS } from 'date-fns/locale';

describe('formatDateISOStringToDate', () => {
  describe('date-only ISO strings (no time component)', () => {
    it('should render the calendar date with DAY_FIRST format', () => {
      const result = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2022');
    });

    it('should render the calendar date with MONTH_FIRST format', () => {
      const result = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: DateFormat.MONTH_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('Jan 1, 2022');
    });

    it('should render the calendar date with YEAR_FIRST format', () => {
      const result = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: DateFormat.YEAR_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('2022 Jan 1');
    });

    it('should render the same calendar date regardless of the user timezone', () => {
      const resultUtc = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });
      const resultLA = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'America/Los_Angeles',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });
      const resultTokyo = formatDateISOStringToDate({
        date: '2022-01-01',
        timeZone: 'Asia/Tokyo',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(resultUtc).toBe('1 Jan, 2022');
      expect(resultLA).toBe('1 Jan, 2022');
      expect(resultTokyo).toBe('1 Jan, 2022');
    });

    it('should preserve year boundaries on the last day of the year', () => {
      const result = formatDateISOStringToDate({
        date: '2024-12-31',
        timeZone: 'America/Los_Angeles',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('31 Dec, 2024');
    });

    it('should preserve year boundaries on the first day of the year', () => {
      const result = formatDateISOStringToDate({
        date: '2025-01-01',
        timeZone: 'Asia/Tokyo',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2025');
    });
  });

  describe('datetime ISO strings', () => {
    it('should render the date in UTC when timeZone is UTC', () => {
      const result = formatDateISOStringToDate({
        date: '2022-01-01T12:00:00Z',
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2022');
    });

    it('should shift the displayed day when the timezone rolls the date over', () => {
      // 2022-01-01 00:00 UTC = 2021-12-31 19:00 in America/New_York (UTC-5).
      const result = formatDateISOStringToDate({
        date: '2022-01-01T00:00:00Z',
        timeZone: 'America/New_York',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('31 Dec, 2021');
    });

    it('should shift the displayed day forward when the timezone is ahead of UTC', () => {
      // 2022-01-01 22:00 UTC = 2022-01-02 07:00 in Asia/Tokyo (UTC+9).
      const result = formatDateISOStringToDate({
        date: '2022-01-01T22:00:00Z',
        timeZone: 'Asia/Tokyo',
        dateFormat: DateFormat.DAY_FIRST,
        localeCatalog: enUS,
      });

      expect(result).toBe('2 Jan, 2022');
    });
  });

  describe('persian calendar', () => {
    it('should format date-only values without shifting the day in any timezone', () => {
      const timeZones = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'];

      for (const timeZone of timeZones) {
        expect(
          formatDateISOStringToDate({
            date: '2026-03-21',
            timeZone,
            dateFormat: DateFormat.DAY_FIRST,
            calendar: 'persian',
          }),
        ).toBe('۱ فروردین ۱۴۰۵');
      }
    });

    it('should keep UTC midnight on the same day when displayed in UTC', () => {
      expect(
        formatDateISOStringToDate({
          date: '2026-09-28T00:00:00.000Z',
          timeZone: 'UTC',
          dateFormat: DateFormat.DAY_FIRST,
          calendar: 'persian',
        }),
      ).toBe('۶ مهر ۱۴۰۵');
    });

    it('should resolve instants in the user timezone', () => {
      // 2026-09-27 21:00 UTC = 2026-09-28 00:30 in Asia/Tehran (UTC+3:30).
      expect(
        formatDateISOStringToDate({
          date: '2026-09-27T21:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.MONTH_FIRST,
          calendar: 'persian',
        }),
      ).toBe('مهر ۶، ۱۴۰۵');
    });
  });
});
