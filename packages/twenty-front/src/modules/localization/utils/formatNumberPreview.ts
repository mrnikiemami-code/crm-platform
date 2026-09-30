import { NumberFormat } from '@/localization/constants/NumberFormat';
import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { detectNumberFormat } from '@/localization/utils/detection/detectNumberFormat';
import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';
import { formatNumber } from '~/utils/format/formatNumber';

// Only COMMAS_AND_DOT shares the grouping/decimal roles of the Persian
// separators; the other formats keep their own separators so the options stay
// distinguishable.
export const formatNumberPreview = ({
  value,
  numberFormat,
  decimals,
  calendar,
}: {
  value: number;
  numberFormat: NumberFormat;
  decimals: number;
  calendar: CalendarSystem;
}): string => {
  if (calendar !== 'persian') {
    return formatNumber(value, { format: numberFormat, decimals });
  }

  const resolvedNumberFormat =
    numberFormat === NumberFormat.SYSTEM
      ? NumberFormat[detectNumberFormat()]
      : numberFormat;

  if (resolvedNumberFormat === NumberFormat.COMMAS_AND_DOT) {
    return value.toLocaleString(PERSIAN_CALENDAR_INTL_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  return formatDigitsAsPersian(
    formatNumber(value, { format: resolvedNumberFormat, decimals }),
  );
};
