import { Temporal } from 'temporal-polyfill';

export const createPersianPlainDate = ({
  year,
  month,
  day,
}: {
  year: number;
  month: number;
  day: number;
}): Temporal.PlainDate =>
  Temporal.PlainDate.from(
    { calendar: 'persian', year, month, day },
    { overflow: 'reject' },
  );
