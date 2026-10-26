import { COMMON_CHART_CONSTANTS } from '@/page-layout/widgets/graph/constants/CommonChartConstants';
import { isDefined } from 'twenty-shared/utils';

// Latin metrics underestimate Arabic/Persian/CJK glyph advance widths, which
// collapses left margins and makes category ticks collide with bars.
const WIDE_SCRIPT_CHARACTER_WIDTH_RATIO = 0.95 as const;

const WIDE_SCRIPT_PATTERN =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

export const estimateChartLabelCharacterWidthRatio = (
  labels: Array<string | number | null | undefined> | undefined,
): number => {
  if (!isDefined(labels) || labels.length === 0) {
    return COMMON_CHART_CONSTANTS.HORIZONTAL_LABEL_CHARACTER_WIDTH_RATIO;
  }

  const hasWideScript = labels.some((label) =>
    WIDE_SCRIPT_PATTERN.test(String(label ?? '')),
  );

  return hasWideScript
    ? WIDE_SCRIPT_CHARACTER_WIDTH_RATIO
    : COMMON_CHART_CONSTANTS.HORIZONTAL_LABEL_CHARACTER_WIDTH_RATIO;
};
