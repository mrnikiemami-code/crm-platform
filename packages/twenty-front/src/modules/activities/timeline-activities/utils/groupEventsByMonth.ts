import { type TimelineActivity } from '@/activities/timeline-activities/types/TimelineActivity';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { Temporal } from 'temporal-polyfill';
import { isDefined } from 'twenty-shared/utils';

export type EventGroup = {
  month: number;
  year: number;
  items: TimelineActivity[];
};

type GroupEventsByMonthOptions = {
  calendar: CalendarSystem;
  timeZone: string;
};

// month is 0-based in both calendars so groups sort the same way.
const getEventMonthAndYear = (
  happensAt: string,
  options?: GroupEventsByMonthOptions,
) => {
  const date = new Date(happensAt);

  if (options?.calendar === 'persian') {
    const persianDate = Temporal.Instant.fromEpochMilliseconds(date.getTime())
      .toZonedDateTimeISO(options.timeZone)
      .withCalendar('persian');

    return { month: persianDate.month - 1, year: persianDate.year };
  }

  return { month: date.getMonth(), year: date.getFullYear() };
};

export const groupEventsByMonth = (
  events: TimelineActivity[],
  options?: GroupEventsByMonthOptions,
) => {
  const activityGroups: EventGroup[] = [];

  for (const event of events) {
    const { month, year } = getEventMonthAndYear(event.happensAt, options);

    const matchingGroup = activityGroups.find(
      (group) => group.year === year && group.month === month,
    );
    if (isDefined(matchingGroup)) {
      matchingGroup.items.push(event);
    } else {
      activityGroups.push({
        year,
        month,
        items: [event],
      });
    }
  }

  return activityGroups.sort((a, b) => b.year - a.year || b.month - a.month);
};
