import { msg } from '@lingui/core/macro';
import { type AggregateOperations } from 'twenty-shared/types';

import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getChartI18n } from 'src/modules/dashboard/chart-data/utils/chart-i18n.storage';
import { getAggregateOperationLabel } from 'src/modules/dashboard/chart-data/utils/get-aggregate-operation-label.util';
import { getLocalizedChartFieldLabel } from 'src/modules/dashboard/chart-data/utils/get-localized-chart-field-label.util';

export const buildChartAggregateAxisLabel = ({
  aggregateOperation,
  aggregateField,
}: {
  aggregateOperation: AggregateOperations;
  aggregateField: Pick<FlatFieldMetadata, 'label'>;
}): string => {
  const aggregateLabel = getAggregateOperationLabel(aggregateOperation);
  const fieldLabel = getLocalizedChartFieldLabel(aggregateField);

  return getChartI18n()._(msg`${aggregateLabel} of ${fieldLabel}`);
};
