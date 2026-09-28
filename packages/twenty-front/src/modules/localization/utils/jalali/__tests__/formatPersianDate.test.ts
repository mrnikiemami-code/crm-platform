import { DateFormat } from '@/localization/constants/DateFormat';
import { formatPersianDate } from '@/localization/utils/jalali/formatPersianDate';

const MEHR_6_1405_NOON_UTC = new Date('2026-09-28T12:00:00Z');

describe('formatPersianDate', () => {
  it('should format Nowruz 1405 in the persian calendar', () => {
    expect(
      formatPersianDate({
        date: new Date('2026-03-21T12:00:00Z'),
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('۱ فروردین ۱۴۰۵');
  });

  it('should keep the day-first order for DAY_FIRST', () => {
    expect(
      formatPersianDate({
        date: MEHR_6_1405_NOON_UTC,
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('۶ مهر ۱۴۰۵');
  });

  it('should keep the month-first order for MONTH_FIRST', () => {
    expect(
      formatPersianDate({
        date: MEHR_6_1405_NOON_UTC,
        timeZone: 'UTC',
        dateFormat: DateFormat.MONTH_FIRST,
      }),
    ).toBe('مهر ۶، ۱۴۰۵');
  });

  it('should keep the year-first order for YEAR_FIRST', () => {
    expect(
      formatPersianDate({
        date: MEHR_6_1405_NOON_UTC,
        timeZone: 'UTC',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBe('۱۴۰۵ مهر ۶');
  });

  it('should fall back to the natural day-first order for an unresolved format', () => {
    expect(
      formatPersianDate({
        date: MEHR_6_1405_NOON_UTC,
        timeZone: 'UTC',
        dateFormat: DateFormat.SYSTEM,
      }),
    ).toBe('۶ مهر ۱۴۰۵');
  });

  it('should use Persian digits only', () => {
    const result = formatPersianDate({
      date: MEHR_6_1405_NOON_UTC,
      timeZone: 'UTC',
      dateFormat: DateFormat.DAY_FIRST,
    });

    expect(result).toMatch(/[۰-۹]/);
    expect(result).not.toMatch(/[0-9]/);
  });

  it('should resolve the calendar day in the given timezone', () => {
    // 2026-09-27 21:00 UTC is already 2026-09-28 00:30 in Asia/Tehran.
    const lateEvening = new Date('2026-09-27T21:00:00Z');

    expect(
      formatPersianDate({
        date: lateEvening,
        timeZone: 'UTC',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('۵ مهر ۱۴۰۵');
    expect(
      formatPersianDate({
        date: lateEvening,
        timeZone: 'Asia/Tehran',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('۶ مهر ۱۴۰۵');
  });
});
