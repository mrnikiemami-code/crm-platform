import { setupI18n } from '@lingui/core';
import { AggregateOperations } from 'twenty-shared/types';

import { withChartI18n } from 'src/modules/dashboard/chart-data/utils/chart-i18n.storage';
import { getAggregateOperationLabel } from 'src/modules/dashboard/chart-data/utils/get-aggregate-operation-label.util';
import { buildChartAggregateAxisLabel } from 'src/modules/dashboard/chart-data/utils/build-chart-aggregate-axis-label.util';

describe('getAggregateOperationLabel', () => {
  it('returns English labels without a chart locale store', () => {
    expect(getAggregateOperationLabel(AggregateOperations.COUNT)).toBe(
      'Count all',
    );
  });

  it('returns Persian labels when chart i18n is fa-IR', () => {
    const faI18n = setupI18n();

    faI18n.load('fa-IR', {
      EkZfen: 'شمارش همه',
      ROdDR9: [['fieldLabel'], ' ', ['aggregateLabel']],
      dB826o: 'شناسه',
    });
    faI18n.activate('fa-IR');

    withChartI18n(faI18n, () => {
      expect(getAggregateOperationLabel(AggregateOperations.COUNT)).toBe(
        'شمارش همه',
      );
      expect(
        buildChartAggregateAxisLabel({
          aggregateOperation: AggregateOperations.COUNT,
          aggregateField: { label: 'ID' },
        }),
      ).toBe('شناسه شمارش همه');
    });
  });
});
