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

  // The FULL selection is forwarded. An empty selection is `[]` (not
  // `undefined`), so the renderer can distinguish "nothing selected" from "no
  // record context at all"; the single-record path stays a one-element array.
  const selectedRecordIds =
    viewableFrontComponentRecordContext?.selectedRecordIds;

  return (
    <Suspense fallback={<FrontComponentSkeletonLoader />}>
      <FrontComponentRenderer
        frontComponentId={viewableFrontComponentId}
        selectedRecordIds={selectedRecordIds}
        loadingFallback={<FrontComponentSkeletonLoader />}
      />
    </Suspense>
  );
};
