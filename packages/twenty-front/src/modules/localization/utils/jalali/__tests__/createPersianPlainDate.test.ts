import { createPersianPlainDate } from '@/localization/utils/jalali/createPersianPlainDate';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';

describe('createPersianPlainDate', () => {
  it('should create a date in the persian calendar', () => {
    const persianPlainDate = createPersianPlainDate({
      year: 1405,
      month: 1,
      day: 1,
    });

    expect(persianPlainDate.calendarId).toBe('persian');
    expect(persianPlainDate.year).toBe(1405);
    expect(persianPlainDate.month).toBe(1);
    expect(persianPlainDate.day).toBe(1);
  });

  describe('Esfand leap behavior', () => {
    it('should give Esfand 30 days in the leap year 1403', () => {
      const esfand1403 = createPersianPlainDate({
        year: 1403,
        month: 12,
        day: 1,
      });

      expect(esfand1403.inLeapYear).toBe(true);
      expect(esfand1403.daysInMonth).toBe(30);
      expect(
        turnPersianPlainDateIntoISOPlainDate(
          createPersianPlainDate({ year: 1403, month: 12, day: 30 }),
        ).toString(),
      ).toBe('2025-03-20');
    });

    it('should give Esfand 29 days in the common year 1404', () => {
      const esfand1404 = createPersianPlainDate({
        year: 1404,
        month: 12,
        day: 1,
      });

      expect(esfand1404.inLeapYear).toBe(false);
      expect(esfand1404.daysInMonth).toBe(29);
    });

    it('should reject Esfand 30 in a common year instead of clamping', () => {
      expect(() =>
        createPersianPlainDate({ year: 1404, month: 12, day: 30 }),
      ).toThrow(RangeError);
    });
  });

  it('should reject out-of-range months and days', () => {
    expect(() =>
      createPersianPlainDate({ year: 1405, month: 13, day: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      createPersianPlainDate({ year: 1405, month: 7, day: 31 }),
    ).toThrow(RangeError);
  });

  describe('month-end addition', () => {
    it('should constrain 31 Shahrivar + 1 month to 30 Mehr', () => {
      const nextMonth = createPersianPlainDate({
        year: 1405,
        month: 6,
        day: 31,
      }).add({ months: 1 });

      expect(nextMonth.month).toBe(7);
      expect(nextMonth.day).toBe(30);
      expect(turnPersianPlainDateIntoISOPlainDate(nextMonth).toString()).toBe(
        '2026-10-22',
      );
    });

    it('should constrain 30 Bahman + 1 month to the last day of Esfand', () => {
      const leapYearEsfand = createPersianPlainDate({
        year: 1403,
        month: 11,
        day: 30,
      }).add({ months: 1 });
      const commonYearEsfand = createPersianPlainDate({
        year: 1404,
        month: 11,
        day: 30,
      }).add({ months: 1 });

      expect(leapYearEsfand.day).toBe(30);
      expect(commonYearEsfand.day).toBe(29);
    });

    it('should roll 30 Esfand + 1 day into Nowruz of the next year', () => {
      const nowruz1404 = createPersianPlainDate({
        year: 1403,
        month: 12,
        day: 30,
      }).add({ days: 1 });

      expect(nowruz1404.year).toBe(1404);
      expect(nowruz1404.month).toBe(1);
      expect(nowruz1404.day).toBe(1);
      expect(turnPersianPlainDateIntoISOPlainDate(nowruz1404).toString()).toBe(
        '2025-03-21',
      );
    });
  });
});
