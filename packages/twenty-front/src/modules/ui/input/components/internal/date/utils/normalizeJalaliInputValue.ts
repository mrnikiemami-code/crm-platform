import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { getJalaliInputDayPeriods } from '@/ui/input/components/internal/date/utils/getJalaliInputDayPeriods';

// Inverse of localizeJalaliInputValue, for the existing ASCII parsers.
export const normalizeJalaliInputValue = (value: string): string => {
  const { am, pm } = getJalaliInputDayPeriods();

  return normalizeLocalizedDigitsToAscii(value)
    .replace(am, 'AM')
    .replace(pm, 'PM');
};
