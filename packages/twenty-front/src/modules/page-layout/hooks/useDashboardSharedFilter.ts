import { dashboardSharedFilterComponentState } from '@/page-layout/states/dashboardSharedFilterComponentState';
import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  EMPTY_DASHBOARD_SHARED_FILTER,
  type DashboardSharedFilter,
  type DashboardSharedSourceFilter,
} from '@/page-layout/types/DashboardSharedFilter';
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

const writeSharedFilterToSearchParams = ({
  sharedFilter,
  searchParams,
}: {
  sharedFilter: DashboardSharedFilter;
  searchParams: URLSearchParams;
}): URLSearchParams => {
  const next = new URLSearchParams(searchParams);

  if (sharedFilter.source === DASHBOARD_SHARED_SOURCE_FILTER.ALL) {
    next.delete(SOURCE_PARAM);
  } else {
    next.set(SOURCE_PARAM, sharedFilter.source);
  }

  if (isNonEmptyString(sharedFilter.dateFrom)) {
    next.set(FROM_PARAM, sharedFilter.dateFrom);
  } else {
    next.delete(FROM_PARAM);
  }

  if (isNonEmptyString(sharedFilter.dateTo)) {
    next.set(TO_PARAM, sharedFilter.dateTo);
  } else {
    next.delete(TO_PARAM);
  }

  return next;
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

  const updateSharedFilter = useCallback(
    (next: DashboardSharedFilter) => {
      setSharedFilter(next);
      setSearchParams(
        writeSharedFilterToSearchParams({ sharedFilter: next, searchParams }),
        { replace: true },
      );
    },
    [searchParams, setSearchParams, setSharedFilter],
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
