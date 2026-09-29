import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';

const getDayPeriodLabel = (hour: number, fallback: string): string =>
  new Intl.DateTimeFormat(PERSIAN_CALENDAR_INTL_LOCALE, {
    hour: 'numeric',
    hourCycle: 'h12',
    timeZone: 'UTC',
  })
    .formatToParts(new Date(Date.UTC(2000, 0, 1, hour)))
    .find((part) => part.type === 'dayPeriod')?.value ?? fallback;

export const getPersianDayPeriodLabels = () => ({
  am: getDayPeriodLabel(1, 'AM'),
  pm: getDayPeriodLabel(13, 'PM'),
});
