import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { type Temporal } from 'temporal-polyfill';
import { isPlainDateInSameMonth } from 'twenty-shared/utils';

export const isPlainDateInSameRecordCalendarMonth = ({
  day,
  referenceDate,
  calendar,
}: {
  day: Temporal.PlainDate;
  referenceDate: Temporal.PlainDate;
  calendar: CalendarSystem;
}): boolean => {
  if (calendar !== 'persian') {
    return isPlainDateInSameMonth(day, referenceDate);
  }

  const persianDay = day.withCalendar('persian');
  const persianReferenceDate = referenceDate.withCalendar('persian');

  return (
    persianDay.year === persianReferenceDate.year &&
    persianDay.month === persianReferenceDate.month
  );
};
