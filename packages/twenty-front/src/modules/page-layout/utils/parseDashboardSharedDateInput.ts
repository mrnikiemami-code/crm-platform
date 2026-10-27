import { DateFormat } from '@/localization/constants/DateFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { Temporal } from 'temporal-polyfill';
import { isNonEmptyString } from 'twenty-shared/utils';

const GREGORIAN_SLASH_OR_DASH =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$|^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;

// Canonical storage is always ISO Gregorian YYYY-MM-DD.
// Persian digits and Jalali calendar years are presentation/input only.
export const parseDashboardSharedDateInput = ({
  value,
  calendar,
  dateFormat,
}: {
  value: string | null | undefined;
  calendar: CalendarSystem;
  dateFormat: DateFormat;
}): string | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalized = normalizeLocalizedDigitsToAscii(value.trim());

  if (!isNonEmptyString(normalized)) {
    return null;
  }

  if (calendar === 'persian') {
    return parseJalaliDateInputString({
      value: normalized,
      dateFormat,
    });
  }

  return parseGregorianDateInputString({
    value: normalized,
    dateFormat,
  });
};

const parseGregorianDateInputString = ({
  value,
  dateFormat,
}: {
  value: string;
  dateFormat: DateFormat;
}): string | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      return Temporal.PlainDate.from(value).toString();
    } catch {
      return null;
    }
  }

  const match = value.match(GREGORIAN_SLASH_OR_DASH);

  if (!match) {
    return null;
  }

  let year: string;
  let month: string;
  let day: string;

  if (isNonEmptyString(match[1])) {
    year = match[1];
    month = match[2];
    day = match[3];
  } else {
    const first = match[4];
    const second = match[5];
    const third = match[6];

    switch (dateFormat) {
      case DateFormat.DAY_FIRST:
        day = first;
        month = second;
        year = third;
        break;
      case DateFormat.MONTH_FIRST:
        month = first;
        day = second;
        year = third;
        break;
      case DateFormat.YEAR_FIRST:
      default:
        year = first;
        month = second;
        day = third;
        break;
    }
  }

  if (year.length !== 4) {
    return null;
  }

  try {
    return Temporal.PlainDate.from({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    }).toString();
  } catch {
    return null;
  }
};

export const isValidCanonicalIsoPlainDate = (value: string | null): boolean => {
  if (!isNonEmptyString(value)) {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
};
