import { formatInTimeZone } from 'date-fns-tz';

import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { formatTimeZoneLabel } from '@/localization/utils/formatTimeZoneLabel';
import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';

// Display-only: the IANA id stays the stored value. The city is kept from the
// IANA id because Intl only exposes zone names, which are shared by many
// cities (e.g. every Central European one).
export const formatLocalizedTimeZoneLabel = (
  ianaTimeZone: string,
  calendar: CalendarSystem,
): string => {
  if (calendar !== 'persian') {
    return formatTimeZoneLabel(ianaTimeZone);
  }

  try {
    const now = new Date();

    const zoneName = new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
      timeZone: ianaTimeZone,
      timeZoneName: 'long',
    })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value;

    const offset = formatDigitsAsPersian(
      formatInTimeZone(now, ianaTimeZone, 'xxx'),
    );

    const city = ianaTimeZone.split('/').slice(-1)[0].replaceAll('_', ' ');

    return [zoneName, city]
      .filter((part) => part !== undefined && part !== '')
      .join(' — ')
      .concat(` (UTC${offset})`);
  } catch {
    return formatTimeZoneLabel(ianaTimeZone);
  }
};
