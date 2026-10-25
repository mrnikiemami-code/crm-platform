import { msg } from '@lingui/core/macro';
import { AggregateOperations } from 'twenty-shared/types';

import { getChartI18n } from 'src/modules/dashboard/chart-data/utils/chart-i18n.storage';

export const getAggregateOperationLabel = (
  operation: AggregateOperations,
): string => {
  const i18n = getChartI18n();

  switch (operation) {
    case AggregateOperations.MIN:
      return i18n._(msg`Min`);
    case AggregateOperations.MAX:
      return i18n._(msg`Max`);
    case AggregateOperations.AVG:
      return i18n._(msg`Average`);
    case AggregateOperations.SUM:
      return i18n._(msg`Sum`);
    case AggregateOperations.COUNT:
      return i18n._(msg`Count all`);
    case AggregateOperations.COUNT_EMPTY:
      return i18n._(msg`Count empty`);
    case AggregateOperations.COUNT_NOT_EMPTY:
      return i18n._(msg`Count not empty`);
    case AggregateOperations.COUNT_UNIQUE_VALUES:
      return i18n._(msg`Count unique values`);
    case AggregateOperations.PERCENTAGE_EMPTY:
      return i18n._(msg`Percent empty`);
    case AggregateOperations.PERCENTAGE_NOT_EMPTY:
      return i18n._(msg`Percent not empty`);
    case AggregateOperations.COUNT_TRUE:
      return i18n._(msg`Count true`);
    case AggregateOperations.COUNT_FALSE:
      return i18n._(msg`Count false`);
    default:
      return i18n._(msg`Count`);
  }
};
