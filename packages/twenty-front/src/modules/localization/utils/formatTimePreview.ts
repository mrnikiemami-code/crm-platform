import { formatInTimeZone } from 'date-fns-tz';

import { type TimeFormat } from '@/localization/constants/TimeFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatPersianTime } from '@/localization/utils/jalali/formatPersianTime';

export const formatTimePreview = ({
  date,
  timeZone,
  timeFormat,
  calendar,
}: {
  date: Date;
  timeZone: string;
  timeFormat: TimeFormat;
  calendar: CalendarSystem;
}): string =>
  calendar === 'persian'
    ? formatPersianTime({ date, timeZone, timeFormat })
    : formatInTimeZone(date, timeZone, timeFormat);
