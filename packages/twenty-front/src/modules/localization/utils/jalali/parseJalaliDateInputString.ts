import { DateFormat } from '@/localization/constants/DateFormat';
import { createPersianPlainDate } from '@/localization/utils/jalali/createPersianPlainDate';
import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';
import { isDefined } from 'twenty-shared/utils';

const JALALI_DATE_INPUT_REGEX = /^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/;
const JALALI_YEAR_DIGITS = 4;

const getJalaliDatePartsInInputOrder = (
  dateFormat: DateFormat,
  [first, second, third]: string[],
) => {
  switch (dateFormat) {
    case DateFormat.DAY_FIRST:
      return { day: first, month: second, year: third };
    case DateFormat.MONTH_FIRST:
      return { month: first, day: second, year: third };
    case DateFormat.YEAR_FIRST:
    default:
      return { year: first, month: second, day: third };
  }
};

// Returns the canonical ISO plain date (YYYY-MM-DD), or null when the input is
// not a real Jalali date: an impossible day is rejected, never constrained.
export const parseJalaliDateInputString = ({
  value,
  dateFormat,
}: {
  value: string;
  dateFormat: DateFormat;
}): string | null => {
  const match = normalizeLocalizedDigitsToAscii(value.trim()).match(
    JALALI_DATE_INPUT_REGEX,
  );

  if (!isDefined(match)) {
    return null;
  }

  const { year, month, day } = getJalaliDatePartsInInputOrder(
    dateFormat,
    match.slice(1),
  );

  if (year.length !== JALALI_YEAR_DIGITS) {
    return null;
  }

  try {
    return turnPersianPlainDateIntoISOPlainDate(
      createPersianPlainDate({
        year: Number(year),
        month: Number(month),
        day: Number(day),
      }),
    ).toString();
  } catch {
    return null;
  }
};
