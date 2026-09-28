import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { updateTemporalValueInCalendar } from '@/localization/utils/updateTemporalValueInCalendar';
import { type Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

// Month boundaries follow the displayed calendar, but every returned day stays
// an iso8601 PlainDate so record placement and queries are unaffected.
export const getRecordCalendarDaysRange = ({
  selectedDate,
  calendarLayout,
  weekStartsOnDayIndex,
  calendar = 'gregory',
}: {
  selectedDate: Temporal.PlainDate;
  calendarLayout: ViewCalendarLayout;
  weekStartsOnDayIndex: number;
  calendar?: CalendarSystem;
}) => {
  const isDayLayout = calendarLayout === ViewCalendarLayout.DAY;
  const isMonthLayout = calendarLayout === ViewCalendarLayout.MONTH;
  const periodStart = isMonthLayout
    ? updateTemporalValueInCalendar({
        value: selectedDate,
        calendar,
        update: (date) => date.with({ day: 1 }),
      })
    : selectedDate;
  const daysInMonth =
    calendar === 'persian'
      ? selectedDate.withCalendar('persian').daysInMonth
      : selectedDate.daysInMonth;
  const daysSinceStartOfWeek =
    ((periodStart.dayOfWeek % 7) - weekStartsOnDayIndex + 7) % 7;
  const firstDay = isDayLayout
    ? selectedDate
    : periodStart.subtract({ days: daysSinceStartOfWeek });
  const daysPerRow = isDayLayout ? 1 : 7;
  const rowCount = isMonthLayout
    ? Math.ceil((daysSinceStartOfWeek + daysInMonth) / 7)
    : 1;
  const days = Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: daysPerRow }, (_, dayIndex) =>
      firstDay.add({ days: rowIndex * daysPerRow + dayIndex }),
    ),
  );

  return {
    firstDay,
    lastDay: firstDay.add({ days: rowCount * daysPerRow - 1 }),
    days,
  };
};
