import { type DateFormat } from '@/localization/constants/DateFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatPlainDateISOString } from '@/localization/utils/formatPlainDateISOString';
import { formatPersianDate } from '@/localization/utils/jalali/formatPersianDate';
import { type Locale } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { isDateWithoutTime } from 'twenty-shared/utils';

export const formatDateISOStringToDate = ({
  date,
  timeZone,
  dateFormat,
  localeCatalog,
  calendar = 'gregory',
}: {
  date: string;
  timeZone: string;
  dateFormat: DateFormat;
  localeCatalog?: Locale;
  calendar?: CalendarSystem;
}) => {
  if (isDateWithoutTime(date)) {
    return formatPlainDateISOString({
      date,
      dateFormat,
      localeCatalog,
      calendar,
    });
  }

  if (calendar === 'persian') {
    return formatPersianDate({ date: new Date(date), timeZone, dateFormat });
  }

  return formatInTimeZone(new Date(date), timeZone, dateFormat, {
    locale: localeCatalog,
  });
};
