import { TimeFormat } from '@/localization/constants/TimeFormat';
import { getJalaliInputDayPeriods } from '@/ui/input/components/internal/date/utils/getJalaliInputDayPeriods';
import { getPersianDigitsBlock } from '@/ui/input/components/internal/date/utils/getPersianDigitsBlock';
import { IMask } from 'react-imask';

export const getJalaliTimeBlocks = (timeFormat: TimeFormat) => {
  const isHour12 = timeFormat === TimeFormat.HOUR_12;
  const { am, pm } = getJalaliInputDayPeriods();

  return {
    HH: getPersianDigitsBlock({
      length: 2,
      from: isHour12 ? 1 : 0,
      to: isHour12 ? 12 : 23,
    }),
    mm: getPersianDigitsBlock({ length: 2, from: 0, to: 59 }),
    aa: {
      mask: IMask.MaskedEnum,
      enum: [am, pm],
      // Latin a/p still pick the day period on a non-Persian keyboard.
      prepareChar: (char: string) => {
        const lowerCaseChar = char.toLowerCase();

        if (lowerCaseChar === 'a') return am[0];
        if (lowerCaseChar === 'p') return pm[0];

        return char;
      },
    },
  };
};
