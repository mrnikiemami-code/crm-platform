import { type TimeFormat } from '@/localization/constants/TimeFormat';
import { formatDigitsAsPersian } from '@/localization/utils/jalali/formatDigitsAsPersian';
import { JALALI_DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/JalaliDateBlocks';
import { getJalaliTimeBlocks } from '@/ui/input/components/internal/date/utils/getJalaliTimeBlocks';
import { getTimeMask } from '@/ui/input/components/internal/date/utils/getTimeMask';
import { isDefined } from 'twenty-shared/utils';

// Numeric Jalali input is always year-first, whatever the generic date order
// preference. Any typed digit form is shown with Persian digits.
const JALALI_DATE_MASK = 'YYYY`/MM`/DD`';

export const getJalaliInputMaskOptions = (timeFormat?: TimeFormat) => ({
  mask: isDefined(timeFormat)
    ? `${JALALI_DATE_MASK} ${getTimeMask(timeFormat)}`
    : JALALI_DATE_MASK,
  blocks: isDefined(timeFormat)
    ? { ...JALALI_DATE_BLOCKS, ...getJalaliTimeBlocks(timeFormat) }
    : JALALI_DATE_BLOCKS,
  prepareChar: formatDigitsAsPersian,
  lazy: false,
  autofix: false,
});
