import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { useAggregateRecords } from '@/object-record/hooks/useAggregateRecords';
import { AggregateOperations } from '@/object-record/record-table/constants/AggregateOperations';
import { useGraphWidgetQueryCommon } from '@/page-layout/widgets/graph/hooks/useGraphWidgetQueryCommon';
import {
  SALES_FUNNEL_STAGE_OPTION,
  type SalesFunnelMarker,
} from '@/page-layout/widgets/graph/graph-widget-sales-funnel/utils/salesFunnelMarker';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useMemo } from 'react';
import { ViewFilterOperand } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type AggregateChartConfiguration } from '~/generated-metadata/graphql';

const LEAD_ID_FIELD_NAME = 'id';

type UseGraphWidgetSalesFunnelDataResult = {
  allLeads: number;
  contactedLeads: number;
  registeredLeads: number;
  loading: boolean;
  error?: Error;
};

const buildStageConfiguration = ({
  objectMetadataItemId,
  aggregateFieldMetadataId,
  marker,
  stageOption,
}: {
  objectMetadataItemId: string;
  aggregateFieldMetadataId: string;
  marker: SalesFunnelMarker;
  stageOption?: string;
}): AggregateChartConfiguration =>
  ({
    __typename: 'AggregateChartConfiguration',
    configurationType: 'AGGREGATE_CHART',
    aggregateOperation: AggregateOperations.COUNT,
    aggregateFieldMetadataId,
    filter: {
      recordFilters: isDefined(stageOption)
        ? [
            {
              fieldMetadataId: marker.optionFieldMetadataId,
              value: JSON.stringify([stageOption]),
              operand: ViewFilterOperand.CONTAINS,
              type: 'MULTI_SELECT',
            },
          ]
        : [],
      recordFilterGroups: [],
    },
  }) as AggregateChartConfiguration;

export const useGraphWidgetSalesFunnelData = ({
  objectMetadataItemId,
  aggregateFieldMetadataId,
  marker,
}: {
  objectMetadataItemId: string;
  aggregateFieldMetadataId: string;
  marker: SalesFunnelMarker;
}): UseGraphWidgetSalesFunnelDataResult => {
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataItemId,
  });

  const configurations = useMemo(
    () => ({
      all: buildStageConfiguration({
        objectMetadataItemId,
        aggregateFieldMetadataId,
        marker,
      }),
      contacted: buildStageConfiguration({
        objectMetadataItemId,
        aggregateFieldMetadataId,
        marker,
        stageOption: SALES_FUNNEL_STAGE_OPTION.CONTACTED,
      }),
      registered: buildStageConfiguration({
        objectMetadataItemId,
        aggregateFieldMetadataId,
        marker,
        stageOption: SALES_FUNNEL_STAGE_OPTION.REGISTERED,
      }),
    }),
    [aggregateFieldMetadataId, marker, objectMetadataItemId],
  );

  const all = useGraphWidgetQueryCommon({
    objectMetadataItemId,
    configuration: configurations.all,
  });
  const contacted = useGraphWidgetQueryCommon({
    objectMetadataItemId,
    configuration: configurations.contacted,
  });
  const registered = useGraphWidgetQueryCommon({
    objectMetadataItemId,
    configuration: configurations.registered,
  });

  // Stable aggregate document: one object identity per stage, not per render.
  const countAggregate = useMemo(
    () => ({ [LEAD_ID_FIELD_NAME]: [AggregateOperations.COUNT] }),
    [],
  );

  const allQuery = useAggregateRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFieldsAggregate: countAggregate,
    filter: all.gqlOperationFilter,
  });
  const contactedQuery = useAggregateRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFieldsAggregate: countAggregate,
    filter: contacted.gqlOperationFilter,
  });
  const registeredQuery = useAggregateRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFieldsAggregate: countAggregate,
    filter: registered.gqlOperationFilter,
  });

  const readCount = (data: Record<string, unknown> | undefined): number => {
    const aggregate = data?.[LEAD_ID_FIELD_NAME] as
      | Record<string, unknown>
      | undefined;
    const rawValue = aggregate?.[AggregateOperations.COUNT];

    return Number(rawValue ?? 0);
  };

  return {
    allLeads: readCount(allQuery.data),
    contactedLeads: readCount(contactedQuery.data),
    registeredLeads: readCount(registeredQuery.data),
    loading:
      allQuery.loading || contactedQuery.loading || registeredQuery.loading,
    error:
      allQuery.error ?? contactedQuery.error ?? registeredQuery.error ?? undefined,
  };
};
