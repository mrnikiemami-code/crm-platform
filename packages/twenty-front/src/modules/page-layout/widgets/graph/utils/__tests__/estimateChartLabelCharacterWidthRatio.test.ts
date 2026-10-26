import { COMMON_CHART_CONSTANTS } from '@/page-layout/widgets/graph/constants/CommonChartConstants';
import { estimateChartLabelCharacterWidthRatio } from '@/page-layout/widgets/graph/utils/estimateChartLabelCharacterWidthRatio';

describe('estimateChartLabelCharacterWidthRatio', () => {
  it('uses the Latin ratio for ASCII labels', () => {
    expect(estimateChartLabelCharacterWidthRatio(['Follow-up', 'Cancel'])).toBe(
      COMMON_CHART_CONSTANTS.HORIZONTAL_LABEL_CHARACTER_WIDTH_RATIO,
    );
  });

  it('uses a wider ratio for Persian labels', () => {
    expect(
      estimateChartLabelCharacterWidthRatio(['بی پاسخ', 'پیگیری واریزی']),
    ).toBeGreaterThan(
      COMMON_CHART_CONSTANTS.HORIZONTAL_LABEL_CHARACTER_WIDTH_RATIO,
    );
  });
});
