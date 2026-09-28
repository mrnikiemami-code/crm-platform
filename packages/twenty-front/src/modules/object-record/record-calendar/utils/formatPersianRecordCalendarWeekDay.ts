import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { getUtcNoonDateFromPlainDate } from '@/object-record/record-calendar/utils/getUtcNoonDateFromPlainDate';
import { type Temporal } from 'temporal-polyfill';

export const formatPersianRecordCalendarWeekDay = (day: Temporal.PlainDate) =>
  new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(getUtcNoonDateFromPlainDate(day));
