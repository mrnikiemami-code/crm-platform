import { createPersianPlainDate } from '@/localization/utils/jalali/createPersianPlainDate';
import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';

describe('turnPersianPlainDateIntoISOPlainDate', () => {
  it('should map Nowruz 1405 to 2026-03-21', () => {
    const isoPlainDate = turnPersianPlainDateIntoISOPlainDate(
      createPersianPlainDate({ year: 1405, month: 1, day: 1 }),
    );

    expect(isoPlainDate.calendarId).toBe('iso8601');
    expect(isoPlainDate.toString()).toBe('2026-03-21');
  });

  it('should round trip Jalali -> ISO -> Jalali', () => {
    const originalPersianPlainDate = createPersianPlainDate({
      year: 1405,
      month: 7,
      day: 6,
    });

    const isoPlainDate = turnPersianPlainDateIntoISOPlainDate(
      originalPersianPlainDate,
    );
    const roundTrippedPersianPlainDate =
      turnISOPlainDateIntoPersianPlainDate(isoPlainDate);

    expect(isoPlainDate.toString()).toBe('2026-09-28');
    expect(roundTrippedPersianPlainDate.equals(originalPersianPlainDate)).toBe(
      true,
    );
  });

  it('should round trip every day of a leap and a common Jalali year', () => {
    for (const year of [1403, 1404]) {
      let persianPlainDate = createPersianPlainDate({ year, month: 1, day: 1 });

      while (persianPlainDate.year === year) {
        const roundTripped = turnISOPlainDateIntoPersianPlainDate(
          turnPersianPlainDateIntoISOPlainDate(persianPlainDate).toString(),
        );

        expect(roundTripped.equals(persianPlainDate)).toBe(true);

        persianPlainDate = persianPlainDate.add({ days: 1 });
      }
    }
  });

  describe('serialization guard', () => {
    it('should serialize without a calendar annotation', () => {
      const persianPlainDate = createPersianPlainDate({
        year: 1405,
        month: 7,
        day: 6,
      });

      expect(persianPlainDate.toString()).toContain('[u-ca=persian]');

      const serialized =
        turnPersianPlainDateIntoISOPlainDate(persianPlainDate).toString();

      expect(serialized).toBe('2026-09-28');
      expect(serialized).not.toContain('[u-ca=');
      expect(serialized).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should JSON-serialize without a calendar annotation', () => {
      const isoPlainDate = turnPersianPlainDateIntoISOPlainDate(
        createPersianPlainDate({ year: 1403, month: 12, day: 30 }),
      );

      expect(JSON.stringify({ value: isoPlainDate })).toBe(
        '{"value":"2025-03-20"}',
      );
    });
  });
});
