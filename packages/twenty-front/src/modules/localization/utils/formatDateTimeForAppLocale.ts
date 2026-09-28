import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { getIntlLocaleForAppLocale } from '@/localization/utils/getIntlLocaleForAppLocale';

// The calendar is pinned so locales whose Intl default is not gregorian
// (e.g. ar-SA) keep the gregorian dates the app works with; only fa-IR
// switches to the persian calendar.
export const formatDateTimeForAppLocale = ({
  date,
  locale,
  timeZone,
  options,
}: {
  date: Date;
  locale: string | null | undefined;
  timeZone?: string;
  options: Intl.DateTimeFormatOptions;
}): string =>
  new Intl.DateTimeFormat(getIntlLocaleForAppLocale(locale), {
    ...options,
    calendar: getCalendarSystemForLocale(locale),
    timeZone,
  }).format(date);
