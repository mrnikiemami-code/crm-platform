import { type EventGroup } from '@/activities/timeline-activities/utils/groupEventsByMonth';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { formatYearForAppLocale } from '@/localization/utils/formatYearForAppLocale';

// Labels must be computed in the same calendar and timezone that
// groupEventsByMonth used to build the group.
export const getEventGroupLabels = ({
  group,
  locale,
  calendar,
  timeZone,
}: {
  group: EventGroup;
  locale: string;
  calendar: CalendarSystem;
  timeZone: string;
}) => {
  const isPersianCalendar = calendar === 'persian';

  const monthLabel = formatDateTimeForAppLocale({
    date: new Date(group.items[0].happensAt),
    locale,
    timeZone: isPersianCalendar ? timeZone : undefined,
    options: { month: 'long' },
  });

  const yearLabel = isPersianCalendar
    ? formatYearForAppLocale(group.year, locale)
    : group.year.toString();

  return { monthLabel, yearLabel };
};
