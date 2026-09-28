import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { type Temporal } from 'temporal-polyfill';

type CalendarConvertibleTemporalValue =
  | Temporal.PlainDate
  | Temporal.ZonedDateTime;

// Month and year arithmetic must run in the displayed calendar (Esfand + 1
// month is Farvardin), while the result goes back to iso8601 so it never
// serializes with a [u-ca=...] annotation.
export const updateTemporalValueInCalendar = <
  T extends CalendarConvertibleTemporalValue,
>({
  value,
  calendar,
  update,
}: {
  value: T;
  calendar: CalendarSystem;
  update: (valueInCalendar: T) => T;
}): T => {
  if (calendar === 'gregory') {
    return update(value);
  }

  return update(value.withCalendar(calendar) as T).withCalendar('iso8601') as T;
};
