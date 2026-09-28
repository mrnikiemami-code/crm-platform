import { updateTemporalValueInCalendar } from '@/localization/utils/updateTemporalValueInCalendar';
import { Temporal } from 'temporal-polyfill';

describe('updateTemporalValueInCalendar', () => {
  describe('gregory calendar', () => {
    it('should apply the update to the ISO value as before', () => {
      const plainDate = Temporal.PlainDate.from('2026-01-31');

      expect(
        updateTemporalValueInCalendar({
          value: plainDate,
          calendar: 'gregory',
          update: (value) => value.add({ months: 1 }),
        }).toString(),
      ).toBe(plainDate.add({ months: 1 }).toString());
    });
  });

  describe('persian calendar', () => {
    it('should move from Esfand to Farvardin of the next year', () => {
      // 1404/12/14 + 1 month = 1405/01/14.
      expect(
        updateTemporalValueInCalendar({
          value: Temporal.PlainDate.from('2026-03-05'),
          calendar: 'persian',
          update: (value) => value.add({ months: 1 }),
        }).toString(),
      ).toBe('2026-04-03');
    });

    it('should move from Farvardin back to Esfand of the previous year', () => {
      // 1405/01/01 - 1 month = 1404/12/01.
      expect(
        updateTemporalValueInCalendar({
          value: Temporal.PlainDate.from('2026-03-21'),
          calendar: 'persian',
          update: (value) => value.subtract({ months: 1 }),
        }).toString(),
      ).toBe('2026-02-20');
    });

    it('should keep the last day of Farvardin within the shorter Esfand', () => {
      // 1405/01/31 - 1 month = 1404/12/29, the last day of a common Esfand.
      expect(
        updateTemporalValueInCalendar({
          value: Temporal.PlainDate.from('2026-04-20'),
          calendar: 'persian',
          update: (value) => value.subtract({ months: 1 }),
        }).toString(),
      ).toBe('2026-03-20');
    });

    it('should set the persian month and year', () => {
      // 1405/07/06 with month 12 = 1405/12/06.
      expect(
        updateTemporalValueInCalendar({
          value: Temporal.PlainDate.from('2026-09-28'),
          calendar: 'persian',
          update: (value) => value.with({ month: 12 }),
        }).toString(),
      ).toBe('2027-02-25');
      // 1403/12/30 with year 1404 = 1404/12/29 (1404 is not a leap year).
      expect(
        updateTemporalValueInCalendar({
          value: Temporal.PlainDate.from('2025-03-20'),
          calendar: 'persian',
          update: (value) => value.with({ year: 1404 }),
        }).toString(),
      ).toBe('2026-03-20');
    });

    it('should keep the time and timezone of a zoned date-time', () => {
      const result = updateTemporalValueInCalendar({
        value: Temporal.ZonedDateTime.from(
          '2026-09-28T13:30:00+03:30[Asia/Tehran]',
        ),
        calendar: 'persian',
        update: (value) => value.add({ months: 1 }),
      });

      expect(result.toString()).toBe('2026-10-28T13:30:00+03:30[Asia/Tehran]');
      expect(result.calendarId).toBe('iso8601');
    });

    it('should never return a value annotated with the persian calendar', () => {
      const result = updateTemporalValueInCalendar({
        value: Temporal.PlainDate.from('2026-09-28'),
        calendar: 'persian',
        update: (value) => value.add({ months: 1 }),
      });

      expect(result.calendarId).toBe('iso8601');
      expect(result.toString()).not.toContain('[u-ca=');
    });
  });
});
