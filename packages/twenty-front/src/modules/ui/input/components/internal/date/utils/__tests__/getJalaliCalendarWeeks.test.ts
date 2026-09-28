import { getJalaliCalendarWeeks } from '@/ui/input/components/internal/date/utils/getJalaliCalendarWeeks';
import { Temporal } from 'temporal-polyfill';

const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

const getDaysInMonth = (weeks: ReturnType<typeof getJalaliCalendarWeeks>) =>
  weeks.flat().filter((day) => !day.isOutsideMonth);

describe('getJalaliCalendarWeeks', () => {
  it('should lay out the month in rows of 7 days', () => {
    const weeks = getJalaliCalendarWeeks({
      year: 1405,
      month: 7,
      calendarStartDay: SATURDAY,
    });

    expect(weeks.length).toBeGreaterThanOrEqual(4);
    weeks.forEach((week) => expect(week).toHaveLength(7));
  });

  it('should list the persian days of the month with their ISO dates', () => {
    const daysInMonth = getDaysInMonth(
      getJalaliCalendarWeeks({
        year: 1405,
        month: 7,
        calendarStartDay: SATURDAY,
      }),
    );

    expect(daysInMonth).toHaveLength(30);
    expect(daysInMonth[0]).toEqual({
      isoPlainDate: '2026-09-23',
      dayOfMonth: 1,
      isOutsideMonth: false,
    });
    expect(daysInMonth[5].isoPlainDate).toBe('2026-09-28');
    expect(daysInMonth[29].dayOfMonth).toBe(30);
  });

  it('should give Farvardin 31 days and Esfand 30 days only in leap years', () => {
    const countDays = (year: number, month: number) =>
      getDaysInMonth(
        getJalaliCalendarWeeks({ year, month, calendarStartDay: SATURDAY }),
      ).length;

    expect(countDays(1405, 1)).toBe(31);
    expect(countDays(1403, 12)).toBe(30);
    expect(countDays(1404, 12)).toBe(29);
  });

  it('should start each row on the calendar start day', () => {
    // 1405/07/01 (2026-09-23) is a Wednesday.
    const leadingDays = (calendarStartDay: number) =>
      getJalaliCalendarWeeks({ year: 1405, month: 7, calendarStartDay })[0]
        .length -
      getJalaliCalendarWeeks({
        year: 1405,
        month: 7,
        calendarStartDay,
      })[0].filter((day) => !day.isOutsideMonth).length;

    expect(leadingDays(SATURDAY)).toBe(4);
    expect(leadingDays(SUNDAY)).toBe(3);
    expect(leadingDays(MONDAY)).toBe(2);

    const firstRowStart = getJalaliCalendarWeeks({
      year: 1405,
      month: 7,
      calendarStartDay: SATURDAY,
    })[0][0];

    expect(Temporal.PlainDate.from(firstRowStart.isoPlainDate).dayOfWeek).toBe(
      6,
    );
  });

  it('should fill leading and trailing cells with the neighbouring months', () => {
    const weeks = getJalaliCalendarWeeks({
      year: 1405,
      month: 7,
      calendarStartDay: SATURDAY,
    });
    const leadingDay = weeks[0][0];
    const trailingDay = weeks[weeks.length - 1][6];

    expect(leadingDay).toEqual({
      isoPlainDate: '2026-09-19',
      dayOfMonth: 28,
      isOutsideMonth: true,
    });
    expect(trailingDay).toEqual({
      isoPlainDate: '2026-10-23',
      dayOfMonth: 1,
      isOutsideMonth: true,
    });
  });

  it('should only expose ISO plain dates', () => {
    getJalaliCalendarWeeks({ year: 1405, month: 7, calendarStartDay: SATURDAY })
      .flat()
      .forEach((day) => {
        expect(day.isoPlainDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
  });
});
