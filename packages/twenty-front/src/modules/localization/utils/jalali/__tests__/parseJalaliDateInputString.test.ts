import { DateFormat } from '@/localization/constants/DateFormat';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';

const parseYearFirst = (value: string) =>
  parseJalaliDateInputString({ value, dateFormat: DateFormat.YEAR_FIRST });

describe('parseJalaliDateInputString', () => {
  it('should resolve Nowruz 1405 to its ISO plain date', () => {
    expect(parseYearFirst('1405/01/01')).toBe('2026-03-21');
  });

  it('should resolve 1405/07/06 to 2026-09-28', () => {
    expect(parseYearFirst('1405/07/06')).toBe('2026-09-28');
  });

  it('should accept Persian digits', () => {
    expect(parseYearFirst('۱۴۰۵/۰۷/۰۶')).toBe('2026-09-28');
  });

  it('should accept Arabic-Indic digits', () => {
    expect(parseYearFirst('١٤٠٥/٠٧/٠٦')).toBe('2026-09-28');
  });

  it('should accept ASCII digits', () => {
    expect(parseYearFirst('1405/7/6')).toBe('2026-09-28');
  });

  it('should accept 30 Esfand in a leap year', () => {
    expect(parseYearFirst('1403/12/30')).toBe('2025-03-20');
  });

  it('should reject 30 Esfand in a common year instead of constraining it', () => {
    expect(parseYearFirst('1404/12/30')).toBeNull();
  });

  it('should accept 29 Esfand in a common year', () => {
    expect(parseYearFirst('1404/12/29')).toBe('2026-03-20');
  });

  it('should reject month 13', () => {
    expect(parseYearFirst('1405/13/01')).toBeNull();
  });

  it('should reject a day that does not exist in the month', () => {
    expect(parseYearFirst('1405/07/31')).toBeNull();
    expect(parseYearFirst('1405/07/00')).toBeNull();
    expect(parseYearFirst('1405/00/10')).toBeNull();
  });

  it('should reject incomplete or malformed values', () => {
    expect(parseYearFirst('1405/07/__')).toBeNull();
    expect(parseYearFirst('05/07/06')).toBeNull();
    expect(parseYearFirst('1405-07')).toBeNull();
    expect(parseYearFirst('')).toBeNull();
  });

  it('should follow the day-first and month-first input orders', () => {
    expect(
      parseJalaliDateInputString({
        value: '06/07/1405',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('2026-09-28');
    expect(
      parseJalaliDateInputString({
        value: '07/06/1405',
        dateFormat: DateFormat.MONTH_FIRST,
      }),
    ).toBe('2026-09-28');
  });

  it('should never leak the persian calendar annotation', () => {
    expect(parseYearFirst('1405/07/06')).not.toContain('[u-ca=');
  });
});
