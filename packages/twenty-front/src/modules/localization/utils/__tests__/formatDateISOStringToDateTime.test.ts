import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { formatDateISOStringToDateTime } from '@/localization/utils/formatDateISOStringToDateTime';
import { enUS, faIR } from 'date-fns/locale';

describe('formatDateISOStringToDateTime', () => {
  describe('gregory calendar', () => {
    it('should format with the date-fns patterns by default', () => {
      expect(
        formatDateISOStringToDateTime({
          date: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.MONTH_FIRST,
          timeFormat: TimeFormat.HOUR_12,
          localeCatalog: enUS,
        }),
      ).toBe('Sep 28, 2026 1:30 PM');
    });

    it('should return an empty string for an invalid date', () => {
      expect(
        formatDateISOStringToDateTime({
          date: 'not-a-date',
          timeZone: 'UTC',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_24,
          localeCatalog: enUS,
        }),
      ).toBe('');
    });
  });

  describe('persian calendar', () => {
    const persianParams = {
      localeCatalog: faIR,
      calendar: 'persian' as const,
    };

    it('should format in the user timezone with 24-hour time', () => {
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_24,
        }),
      ).toBe('۶ مهر ۱۴۰۵، ۱۳:۳۰');
    });

    it('should format with 12-hour time', () => {
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_12,
        }),
      ).toBe('۶ مهر ۱۴۰۵، ۱:۳۰ ب.ظ.');
    });

    it('should resolve the calendar day in the user timezone', () => {
      // 2026-09-27 21:00 UTC = 2026-09-28 00:30 in Asia/Tehran (UTC+3:30).
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: '2026-09-27T21:00:00Z',
          timeZone: 'UTC',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_24,
        }),
      ).toBe('۵ مهر ۱۴۰۵، ۲۱:۰۰');
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: '2026-09-27T21:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_24,
        }),
      ).toBe('۶ مهر ۱۴۰۵، ۰۰:۳۰');
    });

    it('should keep the date format ordering', () => {
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.YEAR_FIRST,
          timeFormat: TimeFormat.HOUR_24,
        }),
      ).toBe('۱۴۰۵ مهر ۶، ۱۳:۳۰');
    });

    it('should only use persian digits', () => {
      const result = formatDateISOStringToDateTime({
        ...persianParams,
        date: '2026-09-28T10:00:00Z',
        timeZone: 'Asia/Tehran',
        dateFormat: DateFormat.MONTH_FIRST,
        timeFormat: TimeFormat.HOUR_24,
      });

      expect(result).not.toMatch(/[0-9]/);
      expect(result).toMatch(/[۰-۹]/);
    });

    it('should return an empty string for an invalid date', () => {
      expect(
        formatDateISOStringToDateTime({
          ...persianParams,
          date: 'not-a-date',
          timeZone: 'UTC',
          dateFormat: DateFormat.DAY_FIRST,
          timeFormat: TimeFormat.HOUR_24,
        }),
      ).toBe('');
    });
  });
});
