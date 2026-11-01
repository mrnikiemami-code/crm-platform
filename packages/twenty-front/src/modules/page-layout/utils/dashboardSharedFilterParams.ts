import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  type DashboardSharedFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import { isNonEmptyString } from 'twenty-shared/utils';

export const DASHBOARD_SHARED_SOURCE_PARAM = 'dsSource';
export const DASHBOARD_SHARED_FROM_PARAM = 'dsFrom';
export const DASHBOARD_SHARED_TO_PARAM = 'dsTo';

export const areDashboardSharedFiltersEqual = (
  first: DashboardSharedFilter,
  second: DashboardSharedFilter,
): boolean =>
  first.source === second.source &&
  (first.dateFrom ?? null) === (second.dateFrom ?? null) &&
  (first.dateTo ?? null) === (second.dateTo ?? null);

export const serializeDashboardSharedFilter = (
  sharedFilter: DashboardSharedFilter,
): string =>
  [
    sharedFilter.source === DASHBOARD_SHARED_SOURCE_FILTER.ALL
      ? ''
      : sharedFilter.source,
    sharedFilter.dateFrom ?? '',
    sharedFilter.dateTo ?? '',
  ].join('|');

// Returns null when the commit would not change filter state, so callers can
// skip both the atom write and the URL write (idempotent selection).
export const resolveDashboardSharedFilterCommit = ({
  current,
  next,
}: {
  current: DashboardSharedFilter;
  next: DashboardSharedFilter;
}): DashboardSharedFilter | null =>
  areDashboardSharedFiltersEqual(current, next) ? null : next;

export const buildDashboardSharedSearchParams = ({
  sharedFilter,
  baseSearchParams,
}: {
  sharedFilter: DashboardSharedFilter;
  baseSearchParams: URLSearchParams;
}): URLSearchParams => {
  const next = new URLSearchParams(baseSearchParams);

  if (sharedFilter.source === DASHBOARD_SHARED_SOURCE_FILTER.ALL) {
    next.delete(DASHBOARD_SHARED_SOURCE_PARAM);
  } else {
    next.set(DASHBOARD_SHARED_SOURCE_PARAM, sharedFilter.source);
  }

  if (isNonEmptyString(sharedFilter.dateFrom)) {
    next.set(DASHBOARD_SHARED_FROM_PARAM, sharedFilter.dateFrom);
  } else {
    next.delete(DASHBOARD_SHARED_FROM_PARAM);
  }

  if (isNonEmptyString(sharedFilter.dateTo)) {
    next.set(DASHBOARD_SHARED_TO_PARAM, sharedFilter.dateTo);
  } else {
    next.delete(DASHBOARD_SHARED_TO_PARAM);
  }

  return next;
};
