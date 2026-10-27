import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { flattenedFieldMetadataItemsSelector } from '@/object-metadata/states/flattenedFieldMetadataItemsSelector';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { useCurrentPageLayoutOrThrow } from '@/page-layout/hooks/useCurrentPageLayoutOrThrow';
import { dashboardSharedFilterComponentState } from '@/page-layout/states/dashboardSharedFilterComponentState';
import { buildDashboardSharedRecordFilters } from '@/page-layout/utils/buildDashboardSharedRecordFilters';
import { dropChartRecordFiltersWithDeletedFields } from '@/side-panel/pages/page-layout/utils/dropChartRecordFiltersWithDeletedFields';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useContext } from 'react';
import {
  computeRecordGqlOperationFilter,
  isDefined,
} from 'twenty-shared/utils';
import {
  type AggregateChartConfiguration,
  type BarChartConfiguration,
  type LineChartConfiguration,
  type PieChartConfiguration,
  PageLayoutType,
} from '~/generated-metadata/graphql';
import { UserContext } from '@/users/contexts/UserContext';

export const useGraphWidgetQueryCommon = ({
  objectMetadataItemId,
  configuration,
}: {
  objectMetadataItemId: string;
  configuration:
    | BarChartConfiguration
    | AggregateChartConfiguration
    | LineChartConfiguration
    | PieChartConfiguration;
}) => {
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataItemId,
  });

  const aggregateFieldId = configuration.aggregateFieldMetadataId;

  const aggregateField = objectMetadataItem.readableFields.find(
    (field: { id: string }) => field.id === aggregateFieldId,
  );

  if (!isDefined(aggregateField)) {
    throw new Error('Aggregate field not found');
  }

  const { filterValueDependencies } = useFilterValueDependencies();

  const flattenedFieldMetadataItems = useAtomStateValue(
    flattenedFieldMetadataItemsSelector,
  );

  const objectFieldMetadataIds = new Set(
    objectMetadataItem.fields
      .filter((field) => field.isActive)
      .map((field) => field.id),
  );

  const { recordFilters: sanitizedRecordFilters } =
    dropChartRecordFiltersWithDeletedFields({
      chartFilters: configuration.filter ?? {},
      validFieldMetadataIds: objectFieldMetadataIds,
    });

  const { currentPageLayout } = useCurrentPageLayoutOrThrow();
  const sharedFilter = useAtomComponentStateValue(
    dashboardSharedFilterComponentState,
  );
  const { timeZone } = useContext(UserContext);

  const sharedFilterResult =
    currentPageLayout.type === PageLayoutType.DASHBOARD
      ? buildDashboardSharedRecordFilters({
          sharedFilter,
          objectNameSingular: objectMetadataItem.nameSingular,
          objectFields: objectMetadataItem.fields.filter(
            (field) => field.isActive,
          ),
          allFields: flattenedFieldMetadataItems.filter(
            (field) => field.isActive,
          ),
          timeZone,
        })
      : null;

  const mergedRecordFilters = [
    ...(sanitizedRecordFilters ?? []),
    ...(sharedFilterResult?.recordFilters ?? []),
  ];

  const gqlOperationFilter = computeRecordGqlOperationFilter({
    fieldMetadataItems: flattenedFieldMetadataItems,
    filterValueDependencies,
    recordFilters: mergedRecordFilters,
    recordFilterGroups: configuration.filter?.recordFilterGroups ?? [],
  });

  return {
    objectMetadataItem,
    gqlOperationFilter,
    aggregateField,
    sharedFilterMeta: sharedFilterResult,
  };
};
