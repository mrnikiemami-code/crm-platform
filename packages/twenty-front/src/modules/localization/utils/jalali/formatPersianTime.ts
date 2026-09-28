import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { TimeFormat } from '@/localization/constants/TimeFormat';

export const formatPersianTime = ({
  date,
  timeZone,
  timeFormat,
}: {
  date: Date;
  timeZone: string;
  timeFormat: TimeFormat;
}): string =>
  new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    ...(timeFormat === TimeFormat.HOUR_12
      ? { hour: 'numeric', hourCycle: 'h12' }
      : { hour: '2-digit', hourCycle: 'h23' }),
    minute: '2-digit',
    timeZone,
  }).format(date);
