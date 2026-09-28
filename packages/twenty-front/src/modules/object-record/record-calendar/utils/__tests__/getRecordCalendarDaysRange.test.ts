import { getRecordCalendarDaysRange } from '@/object-record/record-calendar/utils/getRecordCalendarDaysRange';
import { Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

describe('getRecordCalendarDaysRange', () => {
  it.each([
    [ViewCalendarLayout.DAY, '2026-07-15', 1, '2026-07-15', '2026-07-15', 1],
    [ViewCalendarLayout.WEEK, '2026-07-15', 1, '2026-07-13', '2026-07-19', 1],
    [ViewCalendarLayout.WEEK, '2026-01-01', 0, '2025-12-28', '2026-01-03', 1],
    [ViewCalendarLayout.MONTH, '2026-07-15', 1, '2026-06-29', '2026-08-02', 5],
    [ViewCalendarLayout.MONTH, '2026-08-15', 1, '2026-07-27', '2026-09-06', 6],
    [ViewCalendarLayout.MONTH, '2024-02-15', 0, '2024-01-28', '2024-03-02', 5],
    [ViewCalendarLayout.MONTH, '2026-02-15', 0, '2026-02-01', '2026-02-28', 4],
  ])(
    '%s around %s with week start %s covers %s through %s in %s rows',
    (
      calendarLayout,
      selectedDate,
      weekStartsOnDayIndex,
      firstDay,
      lastDay,
      rowCount,
    ) => {
      const range = getRecordCalendarDaysRange({
        selectedDate: Temporal.PlainDate.from(selectedDate),
        calendarLayout,
        weekStartsOnDayIndex,
      });

      expect(range.firstDay.toString()).toBe(firstDay);
      expect(range.lastDay.toString()).toBe(lastDay);
      expect(range.days).toHaveLength(rowCount);
      const daysPerRow = calendarLayout === ViewCalendarLayout.DAY ? 1 : 7;
      expect(range.days.every((row) => row.length === daysPerRow)).toBe(true);
      expect(range.days.flat().map((day) => day.toString())).toEqual(
        Array.from({ length: rowCount * daysPerRow }, (_, index) =>
          Temporal.PlainDate.from(firstDay).add({ days: index }).toString(),
        ),
      );
    },
  );

  it.each([
    // Farvardin 1405: 2026-03-21 (Nowruz, Saturday) to 2026-04-20, 31 days
    [ViewCalendarLayout.MONTH, '2026-03-21', 6, '2026-03-21', '2026-04-24', 5],
    [ViewCalendarLayout.MONTH, '2026-04-20', 6, '2026-03-21', '2026-04-24', 5],
    [ViewCalendarLayout.MONTH, '2026-04-05', 1, '2026-03-16', '2026-04-26', 6],
    [ViewCalendarLayout.MONTH, '2026-04-05', 0, '2026-03-15', '2026-04-25', 6],
    // Esfand 1404: 2026-02-20 (Friday) to 2026-03-20, 29 days
    [ViewCalendarLayout.MONTH, '2026-03-10', 6, '2026-02-14', '2026-03-20', 5],
    // Weeks crossing Nowruz are the same days as in gregorian
    [ViewCalendarLayout.WEEK, '2026-03-20', 6, '2026-03-14', '2026-03-20', 1],
    [ViewCalendarLayout.WEEK, '2026-03-21', 6, '2026-03-21', '2026-03-27', 1],
    [ViewCalendarLayout.WEEK, '2026-03-20', 0, '2026-03-15', '2026-03-21', 1],
    [ViewCalendarLayout.DAY, '2026-03-21', 6, '2026-03-21', '2026-03-21', 1],
  ])(
    'persian %s around %s with week start %s covers %s through %s in %s rows',
    (
      calendarLayout,
      selectedDate,
      weekStartsOnDayIndex,
      firstDay,
      lastDay,
      rowCount,
    ) => {
      const range = getRecordCalendarDaysRange({
        selectedDate: Temporal.PlainDate.from(selectedDate),
        calendarLayout,
        weekStartsOnDayIndex,
        calendar: 'persian',
      });

      expect(range.firstDay.toString()).toBe(firstDay);
      expect(range.lastDay.toString()).toBe(lastDay);
      expect(range.days).toHaveLength(rowCount);
      expect(
        range.days.flat().every((day) => day.calendarId === 'iso8601'),
      ).toBe(true);
    },
  );

  it('keeps week and day ranges identical between calendars', () => {
    for (const calendarLayout of [
      ViewCalendarLayout.WEEK,
      ViewCalendarLayout.DAY,
    ]) {
      const selectedDate = Temporal.PlainDate.from('2026-03-20');
      const gregorianRange = getRecordCalendarDaysRange({
        selectedDate,
        calendarLayout,
        weekStartsOnDayIndex: 6,
      });
      const persianRange = getRecordCalendarDaysRange({
        selectedDate,
        calendarLayout,
        weekStartsOnDayIndex: 6,
        calendar: 'persian',
      });

      expect(persianRange.days.flat().map(String)).toEqual(
        gregorianRange.days.flat().map(String),
      );
    }
  });

  it('starts the Farvardin 1405 grid on Nowruz with a Saturday-first week', () => {
    const range = getRecordCalendarDaysRange({
      selectedDate: Temporal.PlainDate.from('2026-04-01'),
      calendarLayout: ViewCalendarLayout.MONTH,
      weekStartsOnDayIndex: 6,
      calendar: 'persian',
    });
    const firstPersianDay = range.days[0][0].withCalendar('persian');

    expect(range.days[0][0].dayOfWeek).toBe(6);
    expect([
      firstPersianDay.year,
      firstPersianDay.month,
      firstPersianDay.day,
    ]).toEqual([1405, 1, 1]);
  });
});
