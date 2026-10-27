import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  EMPTY_DASHBOARD_SHARED_FILTER,
} from '@/page-layout/types/DashboardSharedFilter';
import { buildDashboardSharedRecordFilters } from '@/page-layout/utils/buildDashboardSharedRecordFilters';
import { ViewFilterOperand } from 'twenty-shared/types';

const EVENT_LEAD_SOURCE_FIELD = {
  id: 'source-field-id',
  name: 'sourceChannelsRaw',
  type: 'TEXT',
};
const EVENT_LEAD_DATE_FIELD = {
  id: 'lead-date-id',
  name: 'sourceEnteredAt',
  type: 'DATE_TIME',
};
const SI_LEAD_RELATION = {
  id: 'si-lead-relation-id',
  name: 'eventLead',
  type: 'RELATION',
};
const SI_OCCURRED_AT = {
  id: 'si-occurred-id',
  name: 'occurredAt',
  type: 'DATE_TIME',
};
const PAYMENT_DATE = {
  id: 'pay-date-id',
  name: 'paymentDate',
  type: 'DATE_TIME',
};

describe('buildDashboardSharedRecordFilters', () => {
  it('adds no filters for default all-time all-sources', () => {
    const result = buildDashboardSharedRecordFilters({
      sharedFilter: EMPTY_DASHBOARD_SHARED_FILTER,
      objectNameSingular: 'eventLead',
      objectFields: [EVENT_LEAD_SOURCE_FIELD, EVENT_LEAD_DATE_FIELD],
      allFields: [EVENT_LEAD_SOURCE_FIELD],
      timeZone: 'UTC',
    });

    expect(result.recordFilters).toEqual([]);
    expect(result.sourceApplied).toBe(false);
    expect(result.dateApplied).toBe(false);
    expect(result.dateStatus).toBe('none');
  });

  it('filters eventLead by Instagram membership token via CONTAINS', () => {
    const result = buildDashboardSharedRecordFilters({
      sharedFilter: {
        ...EMPTY_DASHBOARD_SHARED_FILTER,
        source: DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM,
      },
      objectNameSingular: 'eventLead',
      objectFields: [EVENT_LEAD_SOURCE_FIELD, EVENT_LEAD_DATE_FIELD],
      allFields: [EVENT_LEAD_SOURCE_FIELD],
      timeZone: 'UTC',
    });

    expect(result.sourceApplied).toBe(true);
    expect(result.recordFilters).toHaveLength(1);
    expect(result.recordFilters[0]).toMatchObject({
      fieldMetadataId: EVENT_LEAD_SOURCE_FIELD.id,
      operand: ViewFilterOperand.CONTAINS,
      value: 'اینستاگرام',
    });
  });

  it('filters salesInteraction via eventLead.sourceChannelsRaw traversal', () => {
    const result = buildDashboardSharedRecordFilters({
      sharedFilter: {
        ...EMPTY_DASHBOARD_SHARED_FILTER,
        source: DASHBOARD_SHARED_SOURCE_FILTER.VOICE,
      },
      objectNameSingular: 'salesInteraction',
      objectFields: [SI_LEAD_RELATION, SI_OCCURRED_AT],
      allFields: [EVENT_LEAD_SOURCE_FIELD, SI_LEAD_RELATION, SI_OCCURRED_AT],
      timeZone: 'UTC',
    });

    expect(result.sourceApplied).toBe(true);
    expect(result.recordFilters[0]).toMatchObject({
      fieldMetadataId: SI_LEAD_RELATION.id,
      relationTargetFieldMetadataId: EVENT_LEAD_SOURCE_FIELD.id,
      operand: ViewFilterOperand.CONTAINS,
      value: 'پیام صوتی',
    });
  });

  it('marks registrationPayment source as unscoped (no one-hop join)', () => {
    const result = buildDashboardSharedRecordFilters({
      sharedFilter: {
        ...EMPTY_DASHBOARD_SHARED_FILTER,
        source: DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM,
      },
      objectNameSingular: 'registrationPayment',
      objectFields: [PAYMENT_DATE],
      allFields: [EVENT_LEAD_SOURCE_FIELD, PAYMENT_DATE],
      timeZone: 'UTC',
    });

    expect(result.sourceUnscoped).toBe(true);
    expect(result.sourceApplied).toBe(false);
    expect(
      result.recordFilters.some(
        (filter) => filter.operand === ViewFilterOperand.CONTAINS,
      ),
    ).toBe(false);
  });

  it('applies business-date range and never invents filters when reversed', () => {
    const ok = buildDashboardSharedRecordFilters({
      sharedFilter: {
        source: DASHBOARD_SHARED_SOURCE_FILTER.ALL,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      },
      objectNameSingular: 'salesInteraction',
      objectFields: [SI_LEAD_RELATION, SI_OCCURRED_AT],
      allFields: [SI_OCCURRED_AT],
      timeZone: 'UTC',
    });

    expect(ok.dateApplied).toBe(true);
    expect(ok.dateFilterable).toBe(true);
    expect(ok.recordFilters).toHaveLength(2);
    expect(ok.recordFilters.map((filter) => filter.operand)).toEqual([
      ViewFilterOperand.IS_AFTER,
      ViewFilterOperand.IS_BEFORE,
    ]);
    expect(
      ok.recordFilters.every(
        (filter) => filter.fieldMetadataId === SI_OCCURRED_AT.id,
      ),
    ).toBe(true);

    const reversed = buildDashboardSharedRecordFilters({
      sharedFilter: {
        source: DASHBOARD_SHARED_SOURCE_FILTER.ALL,
        dateFrom: '2026-11-01',
        dateTo: '2026-10-01',
      },
      objectNameSingular: 'salesInteraction',
      objectFields: [SI_LEAD_RELATION, SI_OCCURRED_AT],
      allFields: [SI_OCCURRED_AT],
      timeZone: 'UTC',
    });

    expect(reversed.dateStatus).toBe('invalid');
    expect(reversed.dateApplied).toBe(false);
    expect(reversed.recordFilters).toEqual([]);
  });
});
