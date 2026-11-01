import { dashboardSharedFilterComponentState } from '@/page-layout/states/dashboardSharedFilterComponentState';
import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  EMPTY_DASHBOARD_SHARED_FILTER,
  type DashboardSharedFilter,
  type DashboardSharedSourceFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import {
  buildDashboardSharedSearchParams,
  resolveDashboardSharedFilterCommit,
} from '@/page-layout/utils/dashboardSharedFilterParams';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isNonEmptyString } from 'twenty-shared/utils';

const SOURCE_PARAM = 'dsSource';
const FROM_PARAM = 'dsFrom';
const TO_PARAM = 'dsTo';

const isSourceFilter = (value: string): value is DashboardSharedSourceFilter =>
  value === DASHBOARD_SHARED_SOURCE_FILTER.ALL ||
  value === DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM ||
  value === DASHBOARD_SHARED_SOURCE_FILTER.VOICE;

export const parseDashboardSharedFilterFromSearchParams = (
  searchParams: URLSearchParams,
): DashboardSharedFilter => {
  const sourceRaw = searchParams.get(SOURCE_PARAM);
  const dateFrom = searchParams.get(FROM_PARAM);
  const dateTo = searchParams.get(TO_PARAM);

  return {
    source:
      isNonEmptyString(sourceRaw) && isSourceFilter(sourceRaw)
        ? sourceRaw
        : DASHBOARD_SHARED_SOURCE_FILTER.ALL,
    dateFrom: isNonEmptyString(dateFrom) ? dateFrom : null,
    dateTo: isNonEmptyString(dateTo) ? dateTo : null,
  };
};

export const useDashboardSharedFilter = () => {
  const sharedFilter = useAtomComponentStateValue(
    dashboardSharedFilterComponentState,
  );
  const setSharedFilter = useSetAtomComponentState(
    dashboardSharedFilterComponentState,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const hasHydratedFromUrlRef = useRef(false);

  useLayoutEffect(() => {
    if (hasHydratedFromUrlRef.current) {
      return;
    }

    hasHydratedFromUrlRef.current = true;
    setSharedFilter(parseDashboardSharedFilterFromSearchParams(searchParams));
  }, [searchParams, setSharedFilter]);

  // A date picker emits onChange and onClose for a single day click; both paths
  // land here, so an unchanged filter must not write state or the URL at all.
  const updateSharedFilter = useCallback(
    (next: DashboardSharedFilter) => {
      const commit = resolveDashboardSharedFilterCommit({
        current: sharedFilter,
        next,
      });

      if (commit === null) {
        return;
      }

      setSharedFilter(commit);
      setSearchParams(
        (currentSearchParams) =>
          buildDashboardSharedSearchParams({
            sharedFilter: commit,
            baseSearchParams: currentSearchParams,
          }),
        { replace: true },
      );
    },
    [setSearchParams, setSharedFilter, sharedFilter],
  );

  const clearSharedFilter = useCallback(() => {
    updateSharedFilter(EMPTY_DASHBOARD_SHARED_FILTER);
  }, [updateSharedFilter]);

  return {
    sharedFilter,
    updateSharedFilter,
    clearSharedFilter,
  };
};
