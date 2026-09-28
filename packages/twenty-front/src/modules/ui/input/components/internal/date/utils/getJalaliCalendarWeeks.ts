import { createPersianPlainDate } from '@/localization/utils/jalali/createPersianPlainDate';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';
import { type JalaliCalendarDay } from '@/ui/input/components/internal/date/types/JalaliCalendarDay';
import { Temporal } from 'temporal-polyfill';

const DAYS_IN_WEEK = 7;

// Same numbering as react-datepicker's calendarStartDay: 0 = Sunday.
const getWeekDayNumber = (plainDate: Temporal.PlainDate) =>
  plainDate.dayOfWeek % DAYS_IN_WEEK;

export const getJalaliCalendarWeeks = ({
  year,
  month,
  calendarStartDay,
}: {
  year: number;
  month: number;
  calendarStartDay: number;
}): JalaliCalendarDay[][] => {
  const firstDayOfMonth = createPersianPlainDate({ year, month, day: 1 });
  const lastDayOfMonth = firstDayOfMonth.with({
    day: firstDayOfMonth.daysInMonth,
  });

  const leadingDaysCount =
    (getWeekDayNumber(firstDayOfMonth) - calendarStartDay + DAYS_IN_WEEK) %
    DAYS_IN_WEEK;

  const weeks: JalaliCalendarDay[][] = [];

  for (
    let weekStart = firstDayOfMonth.subtract({ days: leadingDaysCount });
    Temporal.PlainDate.compare(weekStart, lastDayOfMonth) <= 0;
    weekStart = weekStart.add({ days: DAYS_IN_WEEK })
  ) {
    const currentWeekStart = weekStart;

    weeks.push(
      Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => {
        const persianPlainDate = currentWeekStart.add({ days: dayIndex });

        return {
          isoPlainDate:
            turnPersianPlainDateIntoISOPlainDate(persianPlainDate).toString(),
          dayOfMonth: persianPlainDate.day,
          isOutsideMonth:
            persianPlainDate.year !== year || persianPlainDate.month !== month,
        };
      }),
    );
  }

  return weeks;
};
