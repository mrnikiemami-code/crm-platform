import { IMask } from 'react-imask';

import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/DateBlocks';
import { JALALI_DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/JalaliDateBlocks';
import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { getDateMask } from '@/ui/input/components/internal/date/utils/getDateMask';
import { getJalaliDateMask } from '@/ui/input/components/internal/date/utils/getJalaliDateMask';
import { getTimeBlocks } from '@/ui/input/components/internal/date/utils/getTimeBlocks';
import { getTimeMask } from '@/ui/input/components/internal/date/utils/getTimeMask';

const createJalaliDateMask = (dateFormat: DateFormat) =>
  IMask.createMask({
    mask: getJalaliDateMask(dateFormat),
    blocks: JALALI_DATE_BLOCKS,
    prepareChar: normalizeLocalizedDigitsToAscii,
    lazy: false,
    autofix: false,
  });

const createJalaliDateTimeMask = (
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
) =>
  IMask.createMask({
    mask: `${getJalaliDateMask(dateFormat)} ${getTimeMask(timeFormat)}`,
    blocks: { ...JALALI_DATE_BLOCKS, ...getTimeBlocks(timeFormat) },
    prepareChar: normalizeLocalizedDigitsToAscii,
    lazy: false,
    autofix: false,
  });

const typeInto = (
  mask: { resolve: (value: string) => unknown; value: string },
  text: string,
) => {
  mask.resolve(text);

  return mask.value;
};

describe('Jalali date input mask', () => {
  it.each([
    [DateFormat.YEAR_FIRST, '____/__/__'],
    [DateFormat.DAY_FIRST, '__/__/____'],
    [DateFormat.MONTH_FIRST, '__/__/____'],
  ])('shows a neutral %s date mask', (dateFormat, expected) => {
    expect(typeInto(createJalaliDateMask(dateFormat), '')).toBe(expected);
  });

  it('shows a neutral date-time mask', () => {
    expect(
      typeInto(
        createJalaliDateTimeMask(DateFormat.YEAR_FIRST, TimeFormat.HOUR_24),
        '',
      ),
    ).toBe('____/__/__ __:__');
    expect(
      typeInto(
        createJalaliDateTimeMask(DateFormat.DAY_FIRST, TimeFormat.HOUR_24),
        '',
      ),
    ).toBe('__/__/____ __:__');
  });

  it.each([
    ['Persian', '۱۴۰۵۰۷۰۶'],
    ['Arabic-Indic', '١٤٠٥٠٧٠٦'],
    ['ASCII', '14050706'],
  ])('accepts %s digits and keeps the canonical value', (_, typed) => {
    const value = typeInto(createJalaliDateMask(DateFormat.YEAR_FIRST), typed);

    expect(value).toBe('1405/07/06');

    const isoPlainDate = parseJalaliDateInputString({
      value,
      dateFormat: DateFormat.YEAR_FIRST,
    });

    expect(isoPlainDate).toBe('2026-09-28');
    expect(isoPlainDate).not.toContain('u-ca');
  });

  it('types a full date-time in order', () => {
    expect(
      typeInto(
        createJalaliDateTimeMask(DateFormat.YEAR_FIRST, TimeFormat.HOUR_24),
        '۱۴۰۵۰۷۰۶۱۳۳۰',
      ),
    ).toBe('1405/07/06 13:30');
  });

  it('keeps the gregorian date mask for other calendars', () => {
    const mask = IMask.createMask({
      mask: Date,
      pattern: getDateMask(DateFormat.MONTH_FIRST),
      blocks: DATE_BLOCKS,
      min: MIN_DATE,
      max: MAX_DATE,
      lazy: false,
      autofix: true,
    });

    expect(typeInto(mask, '')).toBe('__/__/____');
  });
});
