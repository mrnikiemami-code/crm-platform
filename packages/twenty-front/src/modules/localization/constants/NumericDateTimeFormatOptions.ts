// Same fields as Date#toLocaleString() without options.
export const NUMERIC_DATE_TIME_FORMAT_OPTIONS = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
} satisfies Intl.DateTimeFormatOptions;
