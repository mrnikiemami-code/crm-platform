import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { parseDate } from '~/utils/date-utils';

export const formatToHumanReadableMonth = (
  date: Date | string,
  timeZone: string,
  locale: string,
) =>
  formatDateTimeForAppLocale({
    date: parseDate(date),
    locale,
    timeZone,
    options: { month: 'short' },
  });

export const formatToHumanReadableDay = (
  date: Date | string,
  timeZone: string,
  locale: string,
) =>
  formatDateTimeForAppLocale({
    date: parseDate(date),
    locale,
    timeZone,
    options: { day: 'numeric' },
  });

export const formatToHumanReadableTime = (
  date: Date | string,
  timeZone: string,
  locale: string,
) =>
  formatDateTimeForAppLocale({
    date: parseDate(date),
    locale,
    timeZone,
    options: { hour: 'numeric', minute: 'numeric' },
  });
