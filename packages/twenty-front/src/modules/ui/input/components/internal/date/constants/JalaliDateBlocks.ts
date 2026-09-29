import { getPersianDigitsBlock } from '@/ui/input/components/internal/date/utils/getPersianDigitsBlock';

// Ranges only bound each field; whether the day exists in that Jalali month
// and the year is within the picker range is checked by the inputs once the
// value is complete. The year stays unbounded: a range would turn the digit
// shared by both bounds into a fixed "1" in the visible mask.
export const JALALI_DATE_BLOCKS = {
  YYYY: getPersianDigitsBlock({ length: 4 }),
  MM: getPersianDigitsBlock({ length: 2, from: 1, to: 12 }),
  DD: getPersianDigitsBlock({ length: 2, from: 1, to: 31 }),
};
