import { startOfDay } from 'date-fns';

import { getCalendarEventStartDate } from '@/activities/calendar/utils/getCalendarEventStartDate';
import { getCalendarMonthStartTime } from '@/activities/calendar/utils/getCalendarMonthStartTime';
import { getCalendarYear } from '@/activities/calendar/utils/getCalendarYear';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { type TimelineCalendarEvent } from '~/generated/graphql';
import { groupArrayItemsBy } from '~/utils/array/groupArrayItemsBy';
import { sortDesc } from '~/utils/sort';

export const useCalendarEvents = (
  calendarEvents: TimelineCalendarEvent[],
  calendar: CalendarSystem = 'gregory',
) => {
  const calendarEventsByDayTime = groupArrayItemsBy(
    calendarEvents,
    (calendarEvent) =>
      startOfDay(getCalendarEventStartDate(calendarEvent)).getTime(),
  );

  const sortedDayTimes = Object.keys(calendarEventsByDayTime)
    .map(Number)
    .sort(sortDesc);

  const daysByMonthTime = groupArrayItemsBy(sortedDayTimes, (dayTime) =>
    getCalendarMonthStartTime(dayTime, calendar),
  );

  const sortedMonthTimes = Object.keys(daysByMonthTime)
    .map(Number)
    .sort(sortDesc);

  const monthTimesByYear = groupArrayItemsBy(sortedMonthTimes, (monthTime) =>
    getCalendarYear(monthTime, calendar),
  );

  return {
    calendarEventsByDayTime,
    daysByMonthTime,
    monthTimes: sortedMonthTimes,
    monthTimesByYear,
  };
};
