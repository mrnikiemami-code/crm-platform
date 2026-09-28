import { Temporal } from 'temporal-polyfill';

export const turnISOPlainDateIntoPersianPlainDate = (
  isoPlainDate: string | Temporal.PlainDate,
): Temporal.PlainDate =>
  Temporal.PlainDate.from(isoPlainDate).withCalendar('persian');
