import { type Temporal } from 'temporal-polyfill';

// Values leaving the presentation layer must be iso8601: a Persian PlainDate
// serializes as "YYYY-MM-DD[u-ca=persian]", which the API does not accept.
export const turnPersianPlainDateIntoISOPlainDate = (
  persianPlainDate: Temporal.PlainDate,
): Temporal.PlainDate => persianPlainDate.withCalendar('iso8601');
