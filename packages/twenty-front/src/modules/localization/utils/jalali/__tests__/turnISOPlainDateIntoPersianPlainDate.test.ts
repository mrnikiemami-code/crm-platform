import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { Temporal } from 'temporal-polyfill';

describe('turnISOPlainDateIntoPersianPlainDate', () => {
  it('should map 2026-03-21 to Nowruz 1405 (1 Farvardin)', () => {
    const persianPlainDate = turnISOPlainDateIntoPersianPlainDate('2026-03-21');

    expect(persianPlainDate.calendarId).toBe('persian');
    expect(persianPlainDate.year).toBe(1405);
    expect(persianPlainDate.month).toBe(1);
    expect(persianPlainDate.day).toBe(1);
  });

  it('should map the day before Nowruz to the last day of Esfand', () => {
    const persianPlainDate = turnISOPlainDateIntoPersianPlainDate('2026-03-20');

    expect(persianPlainDate.year).toBe(1404);
    expect(persianPlainDate.month).toBe(12);
    expect(persianPlainDate.day).toBe(29);
  });

  it('should accept a Temporal.PlainDate input', () => {
    const persianPlainDate = turnISOPlainDateIntoPersianPlainDate(
      Temporal.PlainDate.from('2026-09-28'),
    );

    expect(persianPlainDate.year).toBe(1405);
    expect(persianPlainDate.month).toBe(7);
    expect(persianPlainDate.day).toBe(6);
  });

  it('should not mutate the input date calendar', () => {
    const isoPlainDate = Temporal.PlainDate.from('2026-09-28');

    turnISOPlainDateIntoPersianPlainDate(isoPlainDate);

    expect(isoPlainDate.calendarId).toBe('iso8601');
  });
});
