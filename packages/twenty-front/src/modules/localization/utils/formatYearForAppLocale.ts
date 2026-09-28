import { getIntlLocaleForAppLocale } from '@/localization/utils/getIntlLocaleForAppLocale';

export const formatYearForAppLocale = (
  year: number,
  locale: string | null | undefined,
): string =>
  new Intl.NumberFormat(getIntlLocaleForAppLocale(locale), {
    useGrouping: false,
  }).format(year);
