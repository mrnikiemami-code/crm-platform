import { createPersianPlainDate } from '@/localization/utils/jalali/createPersianPlainDate';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';
import { APP_LOCALES } from 'twenty-shared/translations';

const PERSIAN_MONTHS_IN_YEAR = 12;
const REFERENCE_PERSIAN_YEAR = 1400;

export const getPersianMonthSelectOptions = (
  locale: string = APP_LOCALES['fa-IR'],
): { label: string; value: number }[] => {
  const formatter = new Intl.DateTimeFormat(locale, {
    calendar: 'persian',
    month: 'long',
    timeZone: 'UTC',
  });

  return Array.from({ length: PERSIAN_MONTHS_IN_YEAR }, (_, index) => {
    const month = index + 1;
    const isoPlainDate = turnPersianPlainDateIntoISOPlainDate(
      createPersianPlainDate({ year: REFERENCE_PERSIAN_YEAR, month, day: 1 }),
    );

    return {
      label: formatter.format(
        new Date(isoPlainDate.toZonedDateTime('UTC').epochMilliseconds),
      ),
      value: month,
    };
  });
};
