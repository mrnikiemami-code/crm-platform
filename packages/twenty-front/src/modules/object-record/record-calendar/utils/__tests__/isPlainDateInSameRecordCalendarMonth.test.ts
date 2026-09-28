import { isPlainDateInSameRecordCalendarMonth } from '@/object-record/record-calendar/utils/isPlainDateInSameRecordCalendarMonth';
import { Temporal } from 'temporal-polyfill';

describe('isPlainDateInSameRecordCalendarMonth', () => {
  it.each([
    ['2026-03-21', '2026-04-20', 'persian', true],
    ['2026-03-20', '2026-03-21', 'persian', false],
    ['2026-04-21', '2026-04-20', 'persian', false],
    ['2026-03-21', '2026-04-20', 'gregory', false],
    ['2026-03-20', '2026-03-21', 'gregory', true],
  ] as const)(
    '%s and %s in %s -> %s',
    (day, referenceDate, calendar, expected) => {
      expect(
        isPlainDateInSameRecordCalendarMonth({
          day: Temporal.PlainDate.from(day),
          referenceDate: Temporal.PlainDate.from(referenceDate),
          calendar,
        }),
      ).toBe(expected);
    },
  );
});
