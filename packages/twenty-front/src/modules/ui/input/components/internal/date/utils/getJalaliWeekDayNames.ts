import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';

const DAYS_IN_WEEK = 7;
const REFERENCE_SUNDAY_YEAR = 2023;
const REFERENCE_SUNDAY_MONTH_INDEX = 0;
const REFERENCE_SUNDAY_DAY = 1;

export const getJalaliWeekDayNames = (
  calendarStartDay: number,
): { narrowName: string; longName: string }[] => {
  const narrowFormatter = new Intl.DateTimeFormat(
    PERSIAN_CALENDAR_INTL_LOCALE,
    {
      weekday: 'narrow',
      timeZone: 'UTC',
    },
  );
  const longFormatter = new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    weekday: 'long',
    timeZone: 'UTC',
  });

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const weekDayNumber = (calendarStartDay + index) % DAYS_IN_WEEK;
    // 2023-01-01 is a Sunday, so offsetting it by N days lands on weekday N.
    const weekDayDate = new Date(
      Date.UTC(
        REFERENCE_SUNDAY_YEAR,
        REFERENCE_SUNDAY_MONTH_INDEX,
        REFERENCE_SUNDAY_DAY + weekDayNumber,
      ),
    );

    return {
      narrowName: narrowFormatter.format(weekDayDate),
      longName: longFormatter.format(weekDayDate),
    };
  });
};
