import { DateFormat } from '@/localization/constants/DateFormat';
import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { type Temporal } from 'temporal-polyfill';

export const formatJalaliDateInputString = ({
  isoPlainDate,
  dateFormat,
}: {
  isoPlainDate: string | Temporal.PlainDate;
  dateFormat: DateFormat;
}): string => {
  const { year, month, day } =
    turnISOPlainDateIntoPersianPlainDate(isoPlainDate);

  const yearString = year.toString().padStart(4, '0');
  const monthString = month.toString().padStart(2, '0');
  const dayString = day.toString().padStart(2, '0');

  switch (dateFormat) {
    case DateFormat.DAY_FIRST:
      return `${dayString}/${monthString}/${yearString}`;
    case DateFormat.MONTH_FIRST:
      return `${monthString}/${dayString}/${yearString}`;
    case DateFormat.YEAR_FIRST:
    default:
      return `${yearString}/${monthString}/${dayString}`;
  }
};
