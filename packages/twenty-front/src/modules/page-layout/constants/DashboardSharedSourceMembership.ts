import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  type DashboardSharedSourceFilter,
} from '@/page-layout/types/DashboardSharedFilter';

// Membership tokens audited against Dev sourceChannelsRaw values:
// "دیتای اینستاگرام" | "پیام صوتی" | "دیتای اینستاگرام|پیام صوتی"
// CONTAINS match so BOTH-tagged leads appear in each individual scope.
export const DASHBOARD_SHARED_SOURCE_MEMBERSHIP_TOKEN: Record<
  Exclude<DashboardSharedSourceFilter, 'ALL'>,
  string
> = {
  [DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM]: 'اینستاگرام',
  [DASHBOARD_SHARED_SOURCE_FILTER.VOICE]: 'پیام صوتی',
};

export const DASHBOARD_SHARED_SOURCE_FIELD_NAME = 'sourceChannelsRaw';

export const DASHBOARD_SHARED_LEAD_RELATION_FIELD_NAME = 'eventLead';

// Business timestamps only — never import/system createdAt.
export const DASHBOARD_SHARED_BUSINESS_DATE_FIELD_BY_OBJECT: Record<
  string,
  string
> = {
  eventLead: 'sourceEnteredAt',
  salesInteraction: 'occurredAt',
  eventRegistration: 'registeredAt',
  registrationPayment: 'paymentDate',
};

// One-hop relation filter max depth in GraphQL = 1; payments cannot reach lead source.
export const DASHBOARD_SHARED_SOURCE_UNSCOPED_OBJECTS = new Set([
  'registrationPayment',
]);
