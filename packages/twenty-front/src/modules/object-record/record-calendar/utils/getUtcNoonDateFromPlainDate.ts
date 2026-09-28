import { type Temporal } from 'temporal-polyfill';

// Formatting this instant with timeZone 'UTC' always lands on the same plain
// date, whatever the host or user timezone is.
export const getUtcNoonDateFromPlainDate = (plainDate: Temporal.PlainDate) => {
  const isoDate = plainDate.withCalendar('iso8601');

  return new Date(Date.UTC(isoDate.year, isoDate.month - 1, isoDate.day, 12));
};
