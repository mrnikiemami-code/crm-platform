import { shiftRecordCalendarSelectedDate } from '@/object-record/record-calendar/utils/shiftRecordCalendarSelectedDate';
import { Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

describe('shiftRecordCalendarSelectedDate', () => {
  it.each([
    // 19 Esfand 1404 -> 19 Farvardin 1405 (gregorian would be 2026-04-10)
    [ViewCalendarLayout.MONTH, 'persian', '2026-03-10', 1, '2026-04-08'],
    // 1 Farvardin 1405 -> 1 Esfand 1404
    [ViewCalendarLayout.MONTH, 'persian', '2026-03-21', -1, '2026-02-20'],
    // 31 Farvardin 1405 -> 29 Esfand 1404 (clamped) / 31 Ordibehesht 1405
    [ViewCalendarLayout.MONTH, 'persian', '2026-04-20', -1, '2026-03-20'],
    [ViewCalendarLayout.MONTH, 'persian', '2026-04-20', 1, '2026-05-21'],
    [ViewCalendarLayout.WEEK, 'persian', '2026-03-18', 1, '2026-03-25'],
    [ViewCalendarLayout.WEEK, 'persian', '2026-03-25', -1, '2026-03-18'],
    [ViewCalendarLayout.DAY, 'persian', '2026-03-20', 1, '2026-03-21'],
    [ViewCalendarLayout.DAY, 'persian', '2026-03-21', -1, '2026-03-20'],
    [ViewCalendarLayout.MONTH, 'gregory', '2026-03-10', 1, '2026-04-10'],
    [ViewCalendarLayout.MONTH, 'gregory', '2026-01-31', 1, '2026-02-28'],
    [ViewCalendarLayout.WEEK, 'gregory', '2026-07-15', -1, '2026-07-08'],
    [ViewCalendarLayout.DAY, 'gregory', '2026-07-15', 1, '2026-07-16'],
  ] as const)(
    '%s in %s from %s by %s gives %s',
    (calendarLayout, calendar, selectedDate, direction, expected) => {
      const result = shiftRecordCalendarSelectedDate({
        selectedDate: Temporal.PlainDate.from(selectedDate),
        calendarLayout,
        calendar,
        direction,
      });

      expect(result.toString()).toBe(expected);
      expect(result.calendarId).toBe('iso8601');
    },
  );
});
