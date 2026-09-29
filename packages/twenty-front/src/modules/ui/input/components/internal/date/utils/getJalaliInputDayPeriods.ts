import { getPersianDayPeriodLabels } from '@/localization/utils/jalali/getPersianDayPeriodLabels';

// The input stays left-to-right for numeric entry, so each label ends with a
// right-to-left mark to keep its trailing dot inside the label ("ب.ظ." instead
// of ".ب.ظ").
const RIGHT_TO_LEFT_MARK = '\u200F';

export const getJalaliInputDayPeriods = () => {
  const { am, pm } = getPersianDayPeriodLabels();

  return { am: `${am}${RIGHT_TO_LEFT_MARK}`, pm: `${pm}${RIGHT_TO_LEFT_MARK}` };
};
