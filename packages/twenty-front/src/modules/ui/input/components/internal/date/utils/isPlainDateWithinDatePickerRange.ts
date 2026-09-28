import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { Temporal } from 'temporal-polyfill';
import { turnJSDateToPlainDate } from 'twenty-shared/utils';

export const isPlainDateWithinDatePickerRange = (
  plainDate: string | Temporal.PlainDate,
): boolean =>
  Temporal.PlainDate.compare(plainDate, turnJSDateToPlainDate(MIN_DATE)) >= 0 &&
  Temporal.PlainDate.compare(plainDate, turnJSDateToPlainDate(MAX_DATE)) <= 0;
