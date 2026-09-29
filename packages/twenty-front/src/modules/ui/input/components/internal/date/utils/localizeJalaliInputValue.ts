import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';
import { getJalaliInputDayPeriods } from '@/ui/input/components/internal/date/utils/getJalaliInputDayPeriods';

// Turns an ASCII "yyyy/MM/dd[ hh:mm[ AM|PM]]" value into its visible form.
export const localizeJalaliInputValue = (value: string): string => {
  const { am, pm } = getJalaliInputDayPeriods();

  return formatDigitsAsPersian(value).replace('AM', am).replace('PM', pm);
};
