import {
  DASHBOARD_SHARED_BUSINESS_DATE_FIELD_BY_OBJECT,
  DASHBOARD_SHARED_LEAD_RELATION_FIELD_NAME,
  DASHBOARD_SHARED_SOURCE_FIELD_NAME,
  DASHBOARD_SHARED_SOURCE_MEMBERSHIP_TOKEN,
  DASHBOARD_SHARED_SOURCE_UNSCOPED_OBJECTS,
} from '@/page-layout/constants/DashboardSharedSourceMembership';
import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  type DashboardSharedFilter,
  type DashboardSharedSourceFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import { resolveDashboardSharedDateBounds } from '@/page-layout/utils/resolveDashboardSharedDateBounds';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { ViewFilterOperand } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type FieldLike = {
  id: string;
  name: string;
  type: string;
};

export type BuildDashboardSharedRecordFiltersResult = {
  recordFilters: Omit<RecordFilter, 'id'>[];
  sourceApplied: boolean;
  sourceUnscoped: boolean;
  dateApplied: boolean;
  dateFilterable: boolean;
  dateStatus: 'none' | 'ok' | 'invalid';
  dateInvalidReason?: 'reversed' | 'unparseable';
};

export const buildDashboardSharedRecordFilters = ({
  sharedFilter,
  objectNameSingular,
  objectFields,
  allFields,
  timeZone,
}: {
  sharedFilter: DashboardSharedFilter;
  objectNameSingular: string;
  objectFields: FieldLike[];
  allFields: FieldLike[];
  timeZone: string;
}): BuildDashboardSharedRecordFiltersResult => {
  const recordFilters: Omit<RecordFilter, 'id'>[] = [];

  const sourceResult = buildSourceRecordFilter({
    source: sharedFilter.source,
    objectNameSingular,
    objectFields,
    allFields,
  });

  if (isDefined(sourceResult.filter)) {
    recordFilters.push(sourceResult.filter);
  }

  const businessDateFieldName =
    DASHBOARD_SHARED_BUSINESS_DATE_FIELD_BY_OBJECT[objectNameSingular];
  const dateFilterable = isDefined(businessDateFieldName);
  const dateField = dateFilterable
    ? objectFields.find((field) => field.name === businessDateFieldName)
    : undefined;

  const dateBounds = resolveDashboardSharedDateBounds({
    dateFrom: sharedFilter.dateFrom,
    dateTo: sharedFilter.dateTo,
    timeZone,
  });

  let dateApplied = false;

  if (dateBounds.status === 'ok' && isDefined(dateField) && dateFilterable) {
    dateApplied = true;
    recordFilters.push(
      {
        fieldMetadataId: dateField.id,
        value: dateBounds.bounds.rangeStartInstant,
        displayValue: dateBounds.bounds.rangeStartInstant,
        type: 'DATE_TIME',
        operand: ViewFilterOperand.IS_AFTER,
        label: dateField.name,
      },
      {
        fieldMetadataId: dateField.id,
        value: dateBounds.bounds.rangeEndExclusiveInstant,
        displayValue: dateBounds.bounds.rangeEndExclusiveInstant,
        type: 'DATE_TIME',
        operand: ViewFilterOperand.IS_BEFORE,
        label: dateField.name,
      },
    );
  }

  return {
    recordFilters,
    sourceApplied: sourceResult.applied,
    sourceUnscoped: sourceResult.unscoped,
    dateApplied,
    dateFilterable,
    dateStatus: dateBounds.status === 'invalid' ? 'invalid' : dateBounds.status,
    dateInvalidReason:
      dateBounds.status === 'invalid' ? dateBounds.reason : undefined,
  };
};

const buildSourceRecordFilter = ({
  source,
  objectNameSingular,
  objectFields,
  allFields,
}: {
  source: DashboardSharedSourceFilter;
  objectNameSingular: string;
  objectFields: FieldLike[];
  allFields: FieldLike[];
}): {
  filter?: Omit<RecordFilter, 'id'>;
  applied: boolean;
  unscoped: boolean;
} => {
  if (source === DASHBOARD_SHARED_SOURCE_FILTER.ALL) {
    return { applied: false, unscoped: false };
  }

  if (DASHBOARD_SHARED_SOURCE_UNSCOPED_OBJECTS.has(objectNameSingular)) {
    return { applied: false, unscoped: true };
  }

  const membershipToken = DASHBOARD_SHARED_SOURCE_MEMBERSHIP_TOKEN[source];

  const directSourceField = objectFields.find(
    (field) => field.name === DASHBOARD_SHARED_SOURCE_FIELD_NAME,
  );

  if (isDefined(directSourceField)) {
    return {
      applied: true,
      unscoped: false,
      filter: {
        fieldMetadataId: directSourceField.id,
        value: membershipToken,
        displayValue: membershipToken,
        type: 'TEXT',
        operand: ViewFilterOperand.CONTAINS,
        label: directSourceField.name,
      },
    };
  }

  const leadRelationField = objectFields.find(
    (field) => field.name === DASHBOARD_SHARED_LEAD_RELATION_FIELD_NAME,
  );
  const leadSourceField = allFields.find(
    (field) => field.name === DASHBOARD_SHARED_SOURCE_FIELD_NAME,
  );

  if (isDefined(leadRelationField) && isDefined(leadSourceField)) {
    return {
      applied: true,
      unscoped: false,
      filter: {
        fieldMetadataId: leadRelationField.id,
        relationTargetFieldMetadataId: leadSourceField.id,
        value: membershipToken,
        displayValue: membershipToken,
        type: 'TEXT',
        operand: ViewFilterOperand.CONTAINS,
        label: `${leadRelationField.name}.${leadSourceField.name}`,
      },
    };
  }

  return { applied: false, unscoped: true };
};
