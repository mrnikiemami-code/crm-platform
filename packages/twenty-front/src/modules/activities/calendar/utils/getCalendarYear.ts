import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { getYear } from 'date-fns';
import { Temporal } from 'temporal-polyfill';

export const getCalendarYear = (
  time: number,
  calendar: CalendarSystem,
): number => {
  if (calendar !== 'persian') {
    return getYear(time);
  }

  return Temporal.Instant.fromEpochMilliseconds(time)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .withCalendar('persian').year;
};
