import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { useUserDateFormat } from '@/ui/input/components/internal/date/hooks/useUserDateFormat';
import { type Temporal } from 'temporal-polyfill';
import { formatZonedDateTimeDatePart } from '~/utils/dates/formatZonedDateTimeDatePart';

export const useGetDateFilterDisplayValue = () => {
  const { userDateFormat } = useUserDateFormat();
  const { calendar, dateFormat } = useDateTimeFormat();

  const getDateFilterDisplayValue = (zonedDateTime: Temporal.ZonedDateTime) => {
    const displayValue =
      calendar === 'persian'
        ? formatDateISOStringToDate({
            date: zonedDateTime.toInstant().toString(),
            timeZone: zonedDateTime.timeZoneId,
            dateFormat,
            calendar,
          })
        : `${formatZonedDateTimeDatePart(zonedDateTime, userDateFormat)}`;

    return { displayValue };
  };

  return {
    getDateFilterDisplayValue,
  };
};
