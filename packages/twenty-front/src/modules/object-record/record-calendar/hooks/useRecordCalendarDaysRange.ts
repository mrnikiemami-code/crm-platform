import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { detectCalendarStartDay } from '@/localization/utils/detection/detectCalendarStartDay';
import { formatPersianRecordCalendarWeekDay } from '@/object-record/record-calendar/utils/formatPersianRecordCalendarWeekDay';
import { getRecordCalendarDaysRange } from '@/object-record/record-calendar/utils/getRecordCalendarDaysRange';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { format } from 'date-fns';
import { type Temporal } from 'temporal-polyfill';
import { CalendarStartDay } from 'twenty-shared/constants';
import { turnPlainDateToShiftedDateInSystemTimeZone } from 'twenty-shared/utils';
import { type ViewCalendarLayout } from '~/generated-metadata/graphql';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

export const useRecordCalendarDaysRange = (
  selectedDate: Temporal.PlainDate,
  calendarLayout: ViewCalendarLayout,
) => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const dateLocale = useAtomStateValue(dateLocaleState);
  const { calendar } = useDateTimeFormat();
  const calendarStartDay =
    currentWorkspaceMember?.calendarStartDay ?? CalendarStartDay.SYSTEM;
  const weekStartsOnDayIndex =
    calendarStartDay === CalendarStartDay.SYSTEM
      ? CalendarStartDay[detectCalendarStartDay()]
      : calendarStartDay;
  const range = getRecordCalendarDaysRange({
    selectedDate,
    calendarLayout,
    weekStartsOnDayIndex,
    calendar,
  });

  return {
    ...range,
    calendar,
    weekDayLabels: range.days[0].map((day) =>
      calendar === 'persian'
        ? formatPersianRecordCalendarWeekDay(day)
        : format(turnPlainDateToShiftedDateInSystemTimeZone(day), 'EEE', {
            locale: dateLocale.localeCatalog,
          }),
    ),
  };
};
