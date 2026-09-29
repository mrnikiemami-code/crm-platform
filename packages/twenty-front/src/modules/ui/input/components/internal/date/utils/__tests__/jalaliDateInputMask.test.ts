import { IMask } from 'react-imask';

import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/DateBlocks';
import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { getDateMask } from '@/ui/input/components/internal/date/utils/getDateMask';
import { getJalaliInputMaskOptions } from '@/ui/input/components/internal/date/utils/getJalaliInputMaskOptions';
import { localizeJalaliInputValue } from '@/ui/input/components/internal/date/utils/localizeJalaliInputValue';
import { normalizeJalaliInputValue } from '@/ui/input/components/internal/date/utils/normalizeJalaliInputValue';

const RIGHT_TO_LEFT_MARK = '\u200F';

const typeInto = (timeFormat: TimeFormat | undefined, text: string) => {
  const mask = IMask.createMask(getJalaliInputMaskOptions(timeFormat));

  mask.resolve(text);

  return mask.value;
};

describe('Jalali date input mask', () => {
  it('shows a year-first date mask without fixed digits', () => {
    expect(typeInto(undefined, '')).toBe('____/__/__');
  });

  it('shows a year-first date-time mask', () => {
    expect(typeInto(TimeFormat.HOUR_24, '')).toBe('____/__/__ __:__');
    expect(typeInto(TimeFormat.HOUR_12, '')).toMatch(/^____\/__\/__ __:__ _+$/);
  });

  it.each([
    ['Persian', '۱۴۰۵۰۷۰۱'],
    ['Arabic-Indic', '١٤٠٥٠٧٠١'],
    ['ASCII', '14050701'],
  ])('shows %s digits as Persian and keeps the canonical value', (_, typed) => {
    const value = typeInto(undefined, typed);

    expect(value).toBe('۱۴۰۵/۰۷/۰۱');

    const isoPlainDate = parseJalaliDateInputString({
      value: normalizeJalaliInputValue(value),
      dateFormat: DateFormat.YEAR_FIRST,
    });

    expect(isoPlainDate).toBe('2026-09-23');
    expect(isoPlainDate).not.toContain('u-ca');
  });

  it('types a 24-hour date-time in order', () => {
    expect(typeInto(TimeFormat.HOUR_24, '140507011430')).toBe(
      '۱۴۰۵/۰۷/۰۱ ۱۴:۳۰',
    );
  });

  it.each([
    ['p', `ب.ظ.${RIGHT_TO_LEFT_MARK}`],
    ['ب', `ب.ظ.${RIGHT_TO_LEFT_MARK}`],
    ['a', `ق.ظ.${RIGHT_TO_LEFT_MARK}`],
    ['ق', `ق.ظ.${RIGHT_TO_LEFT_MARK}`],
  ])('completes the Persian day period from "%s"', (typed, dayPeriod) => {
    expect(typeInto(TimeFormat.HOUR_12, `14050701 0230${typed}`)).toBe(
      `۱۴۰۵/۰۷/۰۱ ۰۲:۳۰ ${dayPeriod}`,
    );
  });

  it('rejects out-of-range month and hour digits', () => {
    expect(typeInto(undefined, '140513')).toBe('۱۴۰۵/۱_/__');
    expect(typeInto(TimeFormat.HOUR_24, '1405070124')).toBe('۱۴۰۵/۰۷/۰۱ ۲_:__');
  });

  it('round-trips an ASCII value through its visible form', () => {
    const visible = localizeJalaliInputValue('1405/07/01 02:30 PM');

    expect(visible).toBe(`۱۴۰۵/۰۷/۰۱ ۰۲:۳۰ ب.ظ.${RIGHT_TO_LEFT_MARK}`);
    expect(normalizeJalaliInputValue(visible)).toBe('1405/07/01 02:30 PM');
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

    mask.resolve('');

    expect(mask.value).toBe('__/__/____');
  });
});
