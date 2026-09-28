import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { isDefined } from 'twenty-shared/utils';

const isLocaleSupportedByIntl = (locale: string) => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0;
  } catch {
    return false;
  }
};

// App locales Intl does not know (e.g. pseudo-en) would otherwise silently
// fall back to the host locale, which makes the output machine-dependent.
export const getIntlLocaleForAppLocale = (
  locale: string | null | undefined,
): string => {
  if (getCalendarSystemForLocale(locale) === 'persian') {
    return PERSIAN_CALENDAR_INTL_LOCALE;
  }

  if (!isDefined(locale) || !isLocaleSupportedByIntl(locale)) {
    return SOURCE_LOCALE;
  }

  return locale;
};
