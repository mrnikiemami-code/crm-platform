export const DASHBOARD_SHARED_SOURCE_FILTER = {
  ALL: 'ALL',
  INSTAGRAM: 'INSTAGRAM',
  VOICE: 'VOICE',
} as const;

export type DashboardSharedSourceFilter =
  (typeof DASHBOARD_SHARED_SOURCE_FILTER)[keyof typeof DASHBOARD_SHARED_SOURCE_FILTER];

export type DashboardSharedFilter = {
  source: DashboardSharedSourceFilter;
  // ISO plain dates (YYYY-MM-DD) in the user's calendar selection; null = unbound
  dateFrom: string | null;
  dateTo: string | null;
};

export const EMPTY_DASHBOARD_SHARED_FILTER: DashboardSharedFilter = {
  source: DASHBOARD_SHARED_SOURCE_FILTER.ALL,
  dateFrom: null,
  dateTo: null,
};
