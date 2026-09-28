import { DateFormat } from '@/localization/constants/DateFormat';
import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';

// Intl computes the Persian calendar fields; only their order follows the
// user's DateFormat preference. A comma is only added where two numbers would
// otherwise touch (month-first: "مهر ۶، ۱۴۰۵").
export const formatPersianDate = ({
  date,
  timeZone,
  dateFormat,
}: {
  date: Date;
  timeZone: string;
  dateFormat: string;
}): string => {
  const parts = new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).formatToParts(date);

  const getPartValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const day = getPartValue('day');
  const month = getPartValue('month');
  const year = getPartValue('year');

  switch (dateFormat) {
    case DateFormat.MONTH_FIRST:
      return `${month} ${day}، ${year}`;
    case DateFormat.YEAR_FIRST:
      return `${year} ${month} ${day}`;
    case DateFormat.DAY_FIRST:
    default:
      return `${day} ${month} ${year}`;
  }
};
