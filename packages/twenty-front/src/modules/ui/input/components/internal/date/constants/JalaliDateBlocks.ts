import { IMask } from 'react-imask';

import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { turnJSDateToPlainDate } from 'twenty-shared/utils';

// Ranges only bound each field; whether the day exists in that Jalali month
// is checked by parseJalaliDateInputString once the input is complete.
export const JALALI_DATE_BLOCKS = {
  YYYY: {
    mask: IMask.MaskedRange,
    from: turnISOPlainDateIntoPersianPlainDate(turnJSDateToPlainDate(MIN_DATE))
      .year,
    to: turnISOPlainDateIntoPersianPlainDate(turnJSDateToPlainDate(MAX_DATE))
      .year,
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
