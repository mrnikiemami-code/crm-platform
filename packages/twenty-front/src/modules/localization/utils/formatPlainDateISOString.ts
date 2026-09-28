import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatPersianDate } from '@/localization/utils/jalali/formatPersianDate';
import { format, type Locale } from 'date-fns';
import { Temporal } from 'temporal-polyfill';

export const formatPlainDateISOString = ({
  date,
  dateFormat,
  localeCatalog,
  calendar = 'gregory',
}: {
  date: string;
  dateFormat: string;
  localeCatalog?: Locale;
  calendar?: CalendarSystem;
}) => {
  const plainDate = Temporal.PlainDate.from(date);

  if (calendar === 'persian') {
    // A plain date has no timezone: format its UTC midnight in UTC so the
    // calendar day never shifts with the host or user timezone.
    return formatPersianDate({
      date: new Date(
        Date.UTC(plainDate.year, plainDate.month - 1, plainDate.day),
      ),
      timeZone: 'UTC',
      dateFormat,
    });
  }

  return format(
    new Date(plainDate.year, plainDate.month - 1, plainDate.day),
    dateFormat,
    { locale: localeCatalog },
  );
};
