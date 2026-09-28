import { getJalaliYearRange } from '@/localization/utils/jalali/getJalaliYearRange';
import { Temporal } from 'temporal-polyfill';

describe('getJalaliYearRange', () => {
  it('should return a descending range around the Jalali year of the reference date', () => {
    expect(
      getJalaliYearRange({
        referencePlainDate: '2026-09-28',
        yearsBefore: 2,
        yearsAfter: 1,
      }),
    ).toEqual([1406, 1405, 1404, 1403]);
  });

  it('should use the Jalali year boundary (Nowruz), not January 1st', () => {
    const beforeNowruz = getJalaliYearRange({
      referencePlainDate: Temporal.PlainDate.from('2026-03-20'),
      yearsBefore: 0,
      yearsAfter: 0,
    });
    const onNowruz = getJalaliYearRange({
      referencePlainDate: Temporal.PlainDate.from('2026-03-21'),
      yearsBefore: 0,
      yearsAfter: 0,
    });

    expect(beforeNowruz).toEqual([1404]);
    expect(onNowruz).toEqual([1405]);
  });

  it('should return yearsBefore + yearsAfter + 1 years', () => {
    expect(
      getJalaliYearRange({
        referencePlainDate: '2026-09-28',
        yearsBefore: 149,
        yearsAfter: 50,
      }),
    ).toHaveLength(200);
  });
});
