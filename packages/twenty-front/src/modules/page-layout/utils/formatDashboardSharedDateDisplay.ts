import { DateFormat } from '@/localization/constants/DateFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatJalaliDateInputString } from '@/localization/utils/jalali/formatJalaliDateInputString';
import { Temporal } from 'temporal-polyfill';
import { isNonEmptyString } from 'twenty-shared/utils';

export const formatDashboardSharedDateDisplay = ({
  isoPlainDate,
  calendar,
  dateFormat,
}: {
  isoPlainDate: string | null;
  calendar: CalendarSystem;
  dateFormat: DateFormat;
}): string => {
  if (!isNonEmptyString(isoPlainDate)) {
    return '';
  }

  try {
    if (calendar === 'persian') {
      return formatJalaliDateInputString({
        isoPlainDate,
        dateFormat,
      });
    }

    const plainDate = Temporal.PlainDate.from(isoPlainDate);
    const year = plainDate.year.toString().padStart(4, '0');
    const month = plainDate.month.toString().padStart(2, '0');
    const day = plainDate.day.toString().padStart(2, '0');

    switch (dateFormat) {
      case DateFormat.DAY_FIRST:
        return `${day}/${month}/${year}`;
      case DateFormat.MONTH_FIRST:
        return `${month}/${day}/${year}`;
      case DateFormat.YEAR_FIRST:
      default:
        return `${year}-${month}-${day}`;
    }
  } catch {
    return '';
  }
};
