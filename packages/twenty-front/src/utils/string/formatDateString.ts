import { type Locale } from 'date-fns';

import { type DateFormat } from '@/localization/constants/DateFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatDateISOStringToCustomUnicodeFormat } from '@/localization/utils/formatDateISOStringToCustomUnicodeFormat';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { formatDateISOStringToRelativeDate } from '@/localization/utils/formatDateISOStringToRelativeDate';
import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import {
  FieldDateDisplayFormat,
  type FieldDateMetadataSettings,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { isDefined } from 'twenty-shared/utils';

export const formatDateString = ({
  value,
  timeZone,
  dateFormat,
  dateFieldSettings,
  localeCatalog,
  calendar,
}: {
  timeZone: string;
  dateFormat: DateFormat;
  value?: string | null;
  dateFieldSettings?: FieldDateMetadataSettings;
  localeCatalog: Locale;
  // Defaults to the calendar of the date-fns catalog, which is loaded from the
  // same workspace member locale as useDateTimeFormat().calendar.
  calendar?: CalendarSystem;
}): string => {
  if (!isDefined(value)) {
    return '';
  }

  const resolvedCalendar =
    calendar ?? getCalendarSystemForLocale(localeCatalog?.code);

  switch (dateFieldSettings?.displayFormat) {
    case FieldDateDisplayFormat.RELATIVE:
      return formatDateISOStringToRelativeDate({
        isoDate: value,
        isDayMaximumPrecision: true,
        localeCatalog,
        timeZone,
        calendar: resolvedCalendar,
      });
    case FieldDateDisplayFormat.USER_SETTINGS:
      return formatDateISOStringToDate({
        date: value,
        timeZone,
        dateFormat,
        localeCatalog,
        calendar: resolvedCalendar,
      });
    case FieldDateDisplayFormat.CUSTOM:
      return formatDateISOStringToCustomUnicodeFormat({
        date: value,
        timeZone,
        dateFormat: dateFieldSettings.customUnicodeDateFormat,
        localeCatalog,
        calendar: resolvedCalendar,
        fallbackDateFormat: dateFormat,
      });
    default:
      return formatDateISOStringToDate({
        date: value,
        timeZone,
        dateFormat,
        localeCatalog,
        calendar: resolvedCalendar,
      });
  }
};
