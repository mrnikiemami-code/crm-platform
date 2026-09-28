import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { getJalaliYearRange } from '@/localization/utils/jalali/getJalaliYearRange';
import { Temporal } from 'temporal-polyfill';

// Same window as the gregorian year select: 50 years ahead, 200 years total.
const JALALI_YEARS_AFTER = 50;
const JALALI_YEARS_BEFORE = 149;

export const getJalaliYearSelectOptions = (
  referencePlainDate: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): { label: string; value: number }[] => {
  const yearFormatter = new Intl.NumberFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    useGrouping: false,
  });

  return getJalaliYearRange({
    referencePlainDate,
    yearsBefore: JALALI_YEARS_BEFORE,
    yearsAfter: JALALI_YEARS_AFTER,
  }).map((year) => ({ label: yearFormatter.format(year), value: year }));
};
