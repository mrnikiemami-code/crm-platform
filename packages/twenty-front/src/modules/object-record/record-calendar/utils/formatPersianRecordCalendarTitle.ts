import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { type DateFormat } from '@/localization/constants/DateFormat';
import { formatPersianDate } from '@/localization/utils/jalali/formatPersianDate';
import { getUtcNoonDateFromPlainDate } from '@/object-record/record-calendar/utils/getUtcNoonDateFromPlainDate';
import { type Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

// ICU's fa-IR persian patterns for dateStyle 'full' and month + year put the
// year first and mix in an ASCII comma, so the titles are assembled from parts.
export const formatPersianRecordCalendarTitle = ({
  selectedDate,
  calendarLayout,
  firstDay,
  lastDay,
  dateFormat,
}: {
  selectedDate: Temporal.PlainDate;
  calendarLayout: ViewCalendarLayout;
  firstDay: Temporal.PlainDate;
  lastDay: Temporal.PlainDate;
  dateFormat: DateFormat;
}): string => {
  const selectedJSDate = getUtcNoonDateFromPlainDate(selectedDate);

  if (calendarLayout === ViewCalendarLayout.DAY) {
    const weekDay = new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(selectedJSDate);

    return `${weekDay}، ${formatPersianDate({ date: selectedJSDate, timeZone: 'UTC', dateFormat })}`;
  }

  if (calendarLayout === ViewCalendarLayout.WEEK) {
    return new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatRange(
      getUtcNoonDateFromPlainDate(firstDay),
      getUtcNoonDateFromPlainDate(lastDay),
    );
  }

  const monthYearParts = new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(selectedJSDate);

  const getPartValue = (type: Intl.DateTimeFormatPartTypes) =>
    monthYearParts.find((part) => part.type === type)?.value ?? '';

  return `${getPartValue('month')} ${getPartValue('year')}`;
};
