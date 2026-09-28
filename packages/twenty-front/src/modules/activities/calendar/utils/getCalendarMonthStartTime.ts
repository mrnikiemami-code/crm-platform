import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { startOfMonth } from 'date-fns';
import { Temporal } from 'temporal-polyfill';

// Day times are host-local start of day (date-fns startOfDay), so the persian
// month boundary is computed in the host timezone as well.
export const getCalendarMonthStartTime = (
  dayTime: number,
  calendar: CalendarSystem,
): number => {
  if (calendar !== 'persian') {
    return startOfMonth(dayTime).getTime();
  }

  const hostTimeZone = Temporal.Now.timeZoneId();

  return Temporal.Instant.fromEpochMilliseconds(dayTime)
    .toZonedDateTimeISO(hostTimeZone)
    .toPlainDate()
    .withCalendar('persian')
    .with({ day: 1 })
    .toZonedDateTime(hostTimeZone).epochMilliseconds;
};
