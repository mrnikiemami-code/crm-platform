import { type CalendarSystem } from '@/localization/types/CalendarSystem';
import { APP_LOCALES } from 'twenty-shared/translations';

export const getCalendarSystemForLocale = (
  locale: string | null | undefined,
): CalendarSystem => (locale === APP_LOCALES['fa-IR'] ? 'persian' : 'gregory');
