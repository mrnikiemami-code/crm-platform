import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { updateTemporalValueInCalendar } from '@/localization/utils/updateTemporalValueInCalendar';
import { type Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

// Days and weeks are calendar-independent; only month steps need the displayed
// calendar (Esfand + 1 month is Farvardin, not the next gregorian month).
export const shiftRecordCalendarSelectedDate = ({
  selectedDate,
  calendarLayout,
  calendar,
  direction,
}: {
  selectedDate: Temporal.PlainDate;
  calendarLayout: ViewCalendarLayout;
  calendar: CalendarSystem;
  direction: 1 | -1;
}): Temporal.PlainDate => {
  if (calendarLayout === ViewCalendarLayout.DAY) {
    return selectedDate.add({ days: direction });
  }

  if (calendarLayout === ViewCalendarLayout.WEEK) {
    return selectedDate.add({ weeks: direction });
  }

  return updateTemporalValueInCalendar({
    value: selectedDate,
    calendar,
    update: (date) => date.add({ months: direction }),
  });
};
