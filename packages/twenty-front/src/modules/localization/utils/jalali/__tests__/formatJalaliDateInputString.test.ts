import { DateFormat } from '@/localization/constants/DateFormat';
import { formatJalaliDateInputString } from '@/localization/utils/jalali/formatJalaliDateInputString';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { Temporal } from 'temporal-polyfill';

describe('formatJalaliDateInputString', () => {
  it('should format an ISO plain date as a Jalali input value', () => {
    expect(
      formatJalaliDateInputString({
        isoPlainDate: '2026-09-28',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBe('1405/07/06');
  });

  it('should follow the user date format order', () => {
    expect(
      formatJalaliDateInputString({
        isoPlainDate: '2026-09-28',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('06/07/1405');
    expect(
      formatJalaliDateInputString({
        isoPlainDate: '2026-09-28',
        dateFormat: DateFormat.MONTH_FIRST,
      }),
    ).toBe('07/06/1405');
  });

  it.each([
    DateFormat.YEAR_FIRST,
    DateFormat.DAY_FIRST,
    DateFormat.MONTH_FIRST,
  ])(
    'should round trip every day of a leap and a common Jalali year with %s',
    (dateFormat) => {
      // 1403 (leap, 366 days) followed by 1404 (common, 365 days).
      const firstDay = Temporal.PlainDate.from('2024-03-20');

      for (let dayIndex = 0; dayIndex < 731; dayIndex++) {
        const isoPlainDate = firstDay.add({ days: dayIndex }).toString();

        expect(
          parseJalaliDateInputString({
            value: formatJalaliDateInputString({ isoPlainDate, dateFormat }),
            dateFormat,
          }),
        ).toBe(isoPlainDate);
      }
    },
  );
});
