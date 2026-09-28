import { useDateDisplayContext } from '@/localization/hooks/useDateDisplayContext';
import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { useCallback } from 'react';

// Use instead of Date#toLocale*String(), which follows the host locale and
// timezone rather than the app locale (persian calendar for fa-IR) and the
// user timezone.
export const useFormatDateTimeForAppLocale = () => {
  const { locale, timeZone } = useDateDisplayContext();

  return useCallback(
    (date: Date | string | number, options: Intl.DateTimeFormatOptions) => {
      const parsedDate = new Date(date);

      if (Number.isNaN(parsedDate.getTime())) {
        return '';
      }

      return formatDateTimeForAppLocale({
        date: parsedDate,
        locale,
        timeZone,
        options,
      });
    },
    [locale, timeZone],
  );
};
