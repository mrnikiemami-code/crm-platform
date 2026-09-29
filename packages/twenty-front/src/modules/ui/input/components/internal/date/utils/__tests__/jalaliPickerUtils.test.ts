import { JALALI_DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/JalaliDateBlocks';
import { getJalaliWeekDayNames } from '@/ui/input/components/internal/date/utils/getJalaliWeekDayNames';
import { getJalaliYearSelectOptions } from '@/ui/input/components/internal/date/utils/getJalaliYearSelectOptions';
import { isPlainDateWithinDatePickerRange } from '@/ui/input/components/internal/date/utils/isPlainDateWithinDatePickerRange';
import { Temporal } from 'temporal-polyfill';

describe('getJalaliWeekDayNames', () => {
  it('should start the week on the calendar start day', () => {
    const saturdayFirst = getJalaliWeekDayNames(6);

    expect(saturdayFirst).toHaveLength(7);
    expect(saturdayFirst[0].longName).toBe('شنبه');
    expect(saturdayFirst[6].longName).toBe('جمعه');
    expect(getJalaliWeekDayNames(0)[0].longName).toBe('یکشنبه');
    expect(getJalaliWeekDayNames(1)[0].longName).toBe('دوشنبه');
  });
});

describe('getJalaliYearSelectOptions', () => {
  it('should list 200 Jalali years from 50 years ahead with Persian digits', () => {
    const options = getJalaliYearSelectOptions(
      Temporal.PlainDate.from('2026-09-28'),
    );

    expect(options).toHaveLength(200);
    expect(options[0]).toEqual({ label: '۱۴۵۵', value: 1455 });
    expect(options).toContainEqual({ label: '۱۴۰۵', value: 1405 });
    expect(options[199].value).toBe(1256);
  });
});

describe('JALALI_DATE_BLOCKS', () => {
  it('should keep the year an unbounded four digit field and bound month and day', () => {
    expect(JALALI_DATE_BLOCKS.YYYY.mask).toBe('0000');
    expect(JALALI_DATE_BLOCKS.YYYY).not.toHaveProperty('validate');
    expect(JALALI_DATE_BLOCKS.MM).toHaveProperty('validate');
    expect(JALALI_DATE_BLOCKS.DD).toHaveProperty('validate');
  });
});

describe('isPlainDateWithinDatePickerRange', () => {
  it('should accept dates between 1900-01-01 and 2100-12-31', () => {
    expect(isPlainDateWithinDatePickerRange('1900-01-01')).toBe(true);
    expect(isPlainDateWithinDatePickerRange('2026-09-28')).toBe(true);
    expect(isPlainDateWithinDatePickerRange('2100-12-31')).toBe(true);
    expect(isPlainDateWithinDatePickerRange('1899-12-31')).toBe(false);
    expect(isPlainDateWithinDatePickerRange('2101-01-01')).toBe(false);
  });
});
