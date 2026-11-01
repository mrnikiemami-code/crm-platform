import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { flattenedFieldMetadataItemsSelector } from '@/object-metadata/states/flattenedFieldMetadataItemsSelector';
import { useCurrentPageLayoutOrThrow } from '@/page-layout/hooks/useCurrentPageLayoutOrThrow';
import { dashboardSharedFilterComponentState } from '@/page-layout/states/dashboardSharedFilterComponentState';
import { buildDashboardSharedRecordFilters } from '@/page-layout/utils/buildDashboardSharedRecordFilters';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useContext, useMemo } from 'react';
import { PageLayoutType } from '~/generated-metadata/graphql';
import { UserContext } from '@/users/contexts/UserContext';

type ChartConfigurationWithFilter = {
  filter?: {
    recordFilters?: {
      fieldMetadataId: string;
      operand: string;
      value?: string | null;
      type?: string;
      recordFilterGroupId?: string | null;
      subFieldName?: string | null;
      relationTargetFieldMetadataId?: string | null;
    }[];
    recordFilterGroups?: {
      id: string;
      logicalOperator: string;
      parentRecordFilterGroupId?: string | null;
    }[];
  } | null;
};

// Server-rendered chart data (pie/bar/line segments) only honours
// configuration.filter, while aggregate KPIs are filtered client-side. Without
// this merge a scoped dashboard shows filtered centers over unfiltered slices.
export const useDashboardSharedChartConfiguration = <
  TConfiguration extends ChartConfigurationWithFilter,
>({
  objectMetadataItemId,
  configuration,
}: {
  objectMetadataItemId: string;
  configuration: TConfiguration;
}): TConfiguration => {
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataItemId,
  });
  const { currentPageLayout } = useCurrentPageLayoutOrThrow();
  const sharedFilter = useAtomComponentStateValue(
    dashboardSharedFilterComponentState,
  );
  const flattenedFieldMetadataItems = useAtomStateValue(
    flattenedFieldMetadataItemsSelector,
  );
  const { timeZone } = useContext(UserContext);

  return useMemo(() => {
    if (currentPageLayout.type !== PageLayoutType.DASHBOARD) {
      return configuration;
    }

    const sharedFilterResult = buildDashboardSharedRecordFilters({
      sharedFilter,
      objectNameSingular: objectMetadataItem.nameSingular,
      objectFields: objectMetadataItem.fields.filter((field) => field.isActive),
      allFields: flattenedFieldMetadataItems.filter(
        (field) => field.isActive,
      ),
      timeZone,
    });

    if (sharedFilterResult.recordFilters.length === 0) {
      return configuration;
    }

    const existingFilter = configuration.filter ?? {};

    return {
      ...configuration,
      filter: {
        recordFilters: [
          ...(existingFilter.recordFilters ?? []),
          ...sharedFilterResult.recordFilters.map((recordFilter) => ({
            fieldMetadataId: recordFilter.fieldMetadataId,
            operand: recordFilter.operand,
            value: recordFilter.value,
            type: recordFilter.type,
            subFieldName: recordFilter.subFieldName ?? null,
            relationTargetFieldMetadataId:
              recordFilter.relationTargetFieldMetadataId ?? null,
          })),
        ],
        recordFilterGroups: existingFilter.recordFilterGroups ?? [],
      },
    };
  }, [
    configuration,
    currentPageLayout.type,
    flattenedFieldMetadataItems,
    objectMetadataItem,
    sharedFilter,
    timeZone,
  ]);
};
