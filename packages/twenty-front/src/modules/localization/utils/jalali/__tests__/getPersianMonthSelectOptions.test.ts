import { getPersianMonthSelectOptions } from '@/localization/utils/jalali/getPersianMonthSelectOptions';

describe('getPersianMonthSelectOptions', () => {
  it('should return the 12 Persian month names in order for fa-IR', () => {
    expect(getPersianMonthSelectOptions()).toEqual([
      { label: 'فروردین', value: 1 },
      { label: 'اردیبهشت', value: 2 },
      { label: 'خرداد', value: 3 },
      { label: 'تیر', value: 4 },
      { label: 'مرداد', value: 5 },
      { label: 'شهریور', value: 6 },
      { label: 'مهر', value: 7 },
      { label: 'آبان', value: 8 },
      { label: 'آذر', value: 9 },
      { label: 'دی', value: 10 },
      { label: 'بهمن', value: 11 },
      { label: 'اسفند', value: 12 },
    ]);
  });

  it('should use the same shape as the gregorian month options', () => {
    const options = getPersianMonthSelectOptions('fa-IR');

    expect(options).toHaveLength(12);
    expect(options.map(({ value }) => value)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});
