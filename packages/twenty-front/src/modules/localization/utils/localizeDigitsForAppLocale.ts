import { getCalendarSystemForLocale } from '@/localization/utils/getCalendarSystemForLocale';
import { getIntlLocaleForAppLocale } from '@/localization/utils/getIntlLocaleForAppLocale';

// Display-only: the result must never be parsed back. Limited to fa-IR so
// other locales keep their current (latin digit) output.
export const localizeDigitsForAppLocale = (
  text: string,
  locale: string | null | undefined,
): string => {
  if (getCalendarSystemForLocale(locale) !== 'persian') {
    return text;
  }

  const numberFormat = new Intl.NumberFormat(
    getIntlLocaleForAppLocale(locale),
    {
      useGrouping: false,
    },
  );

  return text.replace(/\d+/g, (digits) => numberFormat.format(Number(digits)));
};
