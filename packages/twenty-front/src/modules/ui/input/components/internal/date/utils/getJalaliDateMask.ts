import { DateFormat } from '@/localization/constants/DateFormat';

// Plain numeric blocks (see JALALI_DATE_BLOCKS) instead of IMask's Date mask,
// whose validation assumes gregorian month lengths.
export const getJalaliDateMask = (dateFormat: DateFormat): string => {
  switch (dateFormat) {
    case DateFormat.DAY_FIRST:
      return 'DD`/MM`/YYYY`';
    case DateFormat.MONTH_FIRST:
      return 'MM`/DD`/YYYY`';
    case DateFormat.YEAR_FIRST:
    default:
      return 'YYYY`/MM`/DD`';
  }
};
