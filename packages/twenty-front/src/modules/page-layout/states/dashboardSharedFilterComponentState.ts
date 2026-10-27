import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';
import {
  EMPTY_DASHBOARD_SHARED_FILTER,
  type DashboardSharedFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import { PageLayoutComponentInstanceContext } from '@/page-layout/states/contexts/PageLayoutComponentInstanceContext';

export const dashboardSharedFilterComponentState =
  createAtomComponentState<DashboardSharedFilter>({
    key: 'dashboardSharedFilterComponentState',
    defaultValue: EMPTY_DASHBOARD_SHARED_FILTER,
    componentInstanceContext: PageLayoutComponentInstanceContext,
  });
