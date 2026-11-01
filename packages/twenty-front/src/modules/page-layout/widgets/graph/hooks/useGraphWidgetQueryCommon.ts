import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { flattenedFieldMetadataItemsSelector } from '@/object-metadata/states/flattenedFieldMetadataItemsSelector';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { useCurrentPageLayoutOrThrow } from '@/page-layout/hooks/useCurrentPageLayoutOrThrow';
import { dashboardSharedFilterComponentState } from '@/page-layout/states/dashboardSharedFilterComponentState';
import { buildDashboardSharedRecordFilters } from '@/page-layout/utils/buildDashboardSharedRecordFilters';
import { dropChartRecordFiltersWithDeletedFields } from '@/side-panel/pages/page-layout/utils/dropChartRecordFiltersWithDeletedFields';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useContext, useMemo } from 'react';
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

  // Chart filters come from widget config; rebuilt only when that config or
  // object metadata changes so widget query identity stays stable.
  const sanitizedRecordFilters = useMemo(() => {
    const validFieldMetadataIds = new Set(
      objectMetadataItem.fields
        .filter((field) => field.isActive)
        .map((field) => field.id),
    );

    return (
      dropChartRecordFiltersWithDeletedFields({
        chartFilters: configuration.filter ?? {},
        validFieldMetadataIds,
      }).recordFilters ?? []
    );
  }, [configuration.filter, objectMetadataItem]);

  const { currentPageLayout } = useCurrentPageLayoutOrThrow();
  const sharedFilter = useAtomComponentStateValue(
    dashboardSharedFilterComponentState,
  );
  const { timeZone } = useContext(UserContext);

  // Filter identity must be stable across unrelated re-renders (dropdown open /
  // close, strip renders); otherwise every widget re-observes its Apollo query.
  const { gqlOperationFilter, sharedFilterMeta } = useMemo(() => {
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

    return {
      sharedFilterMeta: sharedFilterResult,
      gqlOperationFilter: computeRecordGqlOperationFilter({
        fieldMetadataItems: flattenedFieldMetadataItems,
        filterValueDependencies,
        recordFilters: [
          ...(sanitizedRecordFilters ?? []),
          ...(sharedFilterResult?.recordFilters ?? []),
        ],
        recordFilterGroups: configuration.filter?.recordFilterGroups ?? [],
      }),
    };
  }, [
    configuration.filter,
    currentPageLayout.type,
    filterValueDependencies,
    flattenedFieldMetadataItems,
    objectMetadataItem,
    sanitizedRecordFilters,
    sharedFilter,
    timeZone,
  ]);

  return {
    objectMetadataItem,
    gqlOperationFilter,
    aggregateField,
    sharedFilterMeta,
  };
};
