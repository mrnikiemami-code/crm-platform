import { type DateFormat } from '@/localization/constants/DateFormat';
import { type TimeFormat } from '@/localization/constants/TimeFormat';
import { type CalendarSystem } from '@/localization/types/CalendarSystem';

export type DateDisplayContext = {
  calendar: CalendarSystem;
  timeZone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};
