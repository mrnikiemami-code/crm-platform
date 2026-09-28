import { DateFormat } from '@/localization/constants/DateFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { formatPlainDateISOString } from '@/localization/utils/formatPlainDateISOString';
import { type Locale } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { isDateWithoutTime } from 'twenty-shared/utils';

export const formatDateISOStringToCustomUnicodeFormat = ({
  date,
  timeZone,
  dateFormat,
  localeCatalog,
  calendar = 'gregory',
  fallbackDateFormat = DateFormat.DAY_FIRST,
}: {
  date: string;
  timeZone: string;
  dateFormat: string;
  localeCatalog: Locale;
  calendar?: CalendarSystem;
  fallbackDateFormat?: DateFormat;
}) => {
  try {
    // Custom formats are date-fns Unicode tokens, which only describe gregorian
    // fields (yyyy, MM, MMMM...). Applying them under the persian calendar would
    // print a gregorian date, so the persian path uses the user's standard
    // date format instead of the custom pattern.
    if (calendar === 'persian') {
      return formatDateISOStringToDate({
        date,
        timeZone,
        dateFormat: fallbackDateFormat,
        calendar,
      });
    }

    if (isDateWithoutTime(date)) {
      return formatPlainDateISOString({ date, dateFormat, localeCatalog });
    }

    return formatInTimeZone(new Date(date), timeZone, dateFormat, {
      locale: localeCatalog,
    });
  } catch {
    return 'Invalid format string';
  }
};
