import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { type Temporal } from 'temporal-polyfill';

export const formatPersianRecordCalendarDayNumber = (day: Temporal.PlainDate) =>
  new Intl.NumberFormat(PERSIAN_CALENDAR_INTL_LOCALE).format(
    day.withCalendar('persian').day,
  );
