import { IMask } from 'react-imask';

// Ranges only bound each field; whether the day exists in that Jalali month
// and the year is within the picker range is checked by the inputs once the
// value is complete. The year stays a plain pattern: a MaskedRange would turn
// the digit shared by both bounds into a fixed "1" in the visible mask.
export const JALALI_DATE_BLOCKS = {
  YYYY: {
    mask: '0000',
  },
  MM: {
    mask: IMask.MaskedRange,
    from: 1,
    to: 12,
  },
  DD: {
    mask: IMask.MaskedRange,
    from: 1,
    to: 31,
  },
};
