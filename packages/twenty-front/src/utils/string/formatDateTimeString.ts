import { type DateFormat } from '@/localization/constants/DateFormat';
import { type TimeFormat } from '@/localization/constants/TimeFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatDateISOStringToCustomUnicodeFormat } from '@/localization/utils/formatDateISOStringToCustomUnicodeFormat';
import { formatDateISOStringToDateTime } from '@/localization/utils/formatDateISOStringToDateTime';
import { formatDateISOStringToRelativeDate } from '@/localization/utils/formatDateISOStringToRelativeDate';
import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import {
  FieldDateDisplayFormat,
  type FieldDateMetadataSettings,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { type Locale } from 'date-fns';

export const formatDateTimeString = ({
  value,
  timeZone,
  dateFormat,
  timeFormat,
  dateFieldSettings,
  localeCatalog,
  calendar,
}: {
  timeZone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  value?: string | null;
  dateFieldSettings?: FieldDateMetadataSettings;
  localeCatalog: Locale;
  // Defaults to the calendar of the date-fns catalog, which is loaded from the
  // same workspace member locale as useDateTimeFormat().calendar.
  calendar?: CalendarSystem;
}) => {
  if (!value) {
    return '';
  }

  const resolvedCalendar =
    calendar ?? getCalendarSystemForLocale(localeCatalog?.code);

  switch (dateFieldSettings?.displayFormat) {
    case FieldDateDisplayFormat.RELATIVE:
      return formatDateISOStringToRelativeDate({
        isoDate: value,
        localeCatalog,
        timeZone,
        calendar: resolvedCalendar,
      });
    case FieldDateDisplayFormat.USER_SETTINGS:
      return formatDateISOStringToDateTime({
        date: value,
        timeZone,
        dateFormat,
        timeFormat,
        localeCatalog,
        calendar: resolvedCalendar,
      });
    case FieldDateDisplayFormat.CUSTOM:
      // Custom date-fns patterns cannot describe persian calendar fields, so
      // fall back to the user's standard date-time format (keeping the time).
      if (resolvedCalendar === 'persian') {
        return formatDateISOStringToDateTime({
          date: value,
          timeZone,
          dateFormat,
          timeFormat,
          localeCatalog,
          calendar: resolvedCalendar,
        });
      }

      return formatDateISOStringToCustomUnicodeFormat({
        date: value,
        timeZone,
        dateFormat: dateFieldSettings.customUnicodeDateFormat,
        localeCatalog,
      });
    default:
      return formatDateISOStringToDateTime({
        date: value,
        timeZone,
        dateFormat,
        timeFormat,
        localeCatalog,
        calendar: resolvedCalendar,
      });
  }
};
