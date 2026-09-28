import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import {
  formatDistance,
  type FormatDistanceFnOptions,
  type FormatDistanceToken,
  type Locale,
} from 'date-fns';
import { enUS } from 'date-fns/locale';

const MINUTES_IN_DAY = 1440;
const HOURS_IN_DAY = 24;

type RelativeTimeParts = {
  unit: Intl.RelativeTimeFormatUnit;
  value: number;
};

const getRelativeTimeParts = (
  token: FormatDistanceToken,
  count: number,
): RelativeTimeParts => {
  switch (token) {
    case 'lessThanXSeconds':
    case 'xSeconds':
    case 'halfAMinute':
    case 'lessThanXMinutes':
      return { unit: 'second', value: 0 };
    case 'xMinutes':
      return { unit: 'minute', value: count };
    case 'aboutXHours':
    case 'xHours':
      return { unit: 'hour', value: count };
    case 'xDays':
      return { unit: 'day', value: count };
    case 'aboutXWeeks':
    case 'xWeeks':
      return { unit: 'week', value: count };
    case 'aboutXMonths':
    case 'xMonths':
      return { unit: 'month', value: count };
    case 'aboutXYears':
    case 'xYears':
    case 'overXYears':
    case 'almostXYears':
      return { unit: 'year', value: count };
  }
};

// Day-level comparisons (start-of-day to start-of-day) only reach sub-day
// tokens for the same day or across a DST shift (23h/25h), so round to days.
const roundSubDayPartsToDays = ({
  unit,
  value,
}: RelativeTimeParts): RelativeTimeParts => {
  switch (unit) {
    case 'second':
      return { unit: 'day', value: 0 };
    case 'minute':
      return { unit: 'day', value: Math.round(value / MINUTES_IN_DAY) };
    case 'hour':
      return { unit: 'day', value: Math.round(value / HOURS_IN_DAY) };
    default:
      return { unit, value };
  }
};

const shouldUseNaturalWording = ({ unit, value }: RelativeTimeParts) =>
  (unit === 'second' && value === 0) || (unit === 'day' && value <= 1);

const createPersianRelativeTimeLocale = (
  isDayLevelComparison: boolean,
): Locale => ({
  ...enUS,
  code: PERSIAN_CALENDAR_INTL_LOCALE,
  formatDistance: (
    token: FormatDistanceToken,
    count: number,
    options?: FormatDistanceFnOptions,
  ) => {
    const tokenParts = getRelativeTimeParts(token, count);
    const parts = isDayLevelComparison
      ? roundSubDayPartsToDays(tokenParts)
      : tokenParts;
    const isFuture = (options?.comparison ?? 0) > 0;
    const signedValue =
      isFuture || parts.value === 0 ? parts.value : -parts.value;

    return new Intl.RelativeTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
      numeric: shouldUseNaturalWording(parts) ? 'auto' : 'always',
    }).format(signedValue, parts.unit);
  },
});

// date-fns formatDistance still selects the unit and amount so the thresholds
// match the gregorian path; only the wording and digits come from Intl.
export const formatPersianRelativeTime = ({
  targetEpochMilliseconds,
  baseEpochMilliseconds,
  isDayLevelComparison,
}: {
  targetEpochMilliseconds: number;
  baseEpochMilliseconds: number;
  isDayLevelComparison: boolean;
}): string =>
  formatDistance(targetEpochMilliseconds, baseEpochMilliseconds, {
    addSuffix: true,
    locale: createPersianRelativeTimeLocale(isDayLevelComparison),
  });
