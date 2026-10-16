import { Suspense, lazy } from 'react';

import { FrontComponentSkeletonLoader } from '@/front-components/components/FrontComponentSkeletonLoader';
import { viewableFrontComponentIdComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentIdComponentState';
import { viewableFrontComponentRecordContextComponentState } from '@/side-panel/pages/front-component/states/viewableFrontComponentRecordContextComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isDefined } from 'twenty-shared/utils';

const FrontComponentRenderer = lazy(() =>
  import('@/front-components/components/FrontComponentRenderer').then(
    (module) => ({ default: module.FrontComponentRenderer }),
  ),
);

export const SidePanelFrontComponentPage = () => {
  const viewableFrontComponentId = useAtomComponentStateValue(
    viewableFrontComponentIdComponentState,
  );

  const viewableFrontComponentRecordContext = useAtomComponentStateValue(
    viewableFrontComponentRecordContextComponentState,
  );

  if (!isDefined(viewableFrontComponentId)) {
    return null;
  }

  // The FULL selection is forwarded, together with the OBJECT the records were
  // selected from. The ids alone do not say which kind of record they are, so a
  // component that must act on a specific entity cannot work without this.
  const selectedRecordIds =
    viewableFrontComponentRecordContext?.selectedRecordIds;
  const objectNameSingular =
    viewableFrontComponentRecordContext?.objectNameSingular;

  return (
    <Suspense fallback={<FrontComponentSkeletonLoader />}>
      <FrontComponentRenderer
        frontComponentId={viewableFrontComponentId}
        selectedRecordIds={selectedRecordIds}
        objectNameSingular={objectNameSingular}
        loadingFallback={<FrontComponentSkeletonLoader />}
      />
    </Suspense>
  );
};
