import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { type Temporal } from 'temporal-polyfill';

export const getJalaliYearRange = ({
  referencePlainDate,
  yearsBefore,
  yearsAfter,
}: {
  referencePlainDate: string | Temporal.PlainDate;
  yearsBefore: number;
  yearsAfter: number;
}): number[] => {
  const referenceJalaliYear =
    turnISOPlainDateIntoPersianPlainDate(referencePlainDate).year;

  return Array.from(
    { length: yearsBefore + yearsAfter + 1 },
    (_, index) => referenceJalaliYear + yearsAfter - index,
  );
};
