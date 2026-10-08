import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

type FrontComponentRecordContext = {
  /**
   * Every record the command was invoked on, in order. This is the SAME array
   * the command menu context already resolved for the selection, so the panel
   * never has to re-derive ids from the DOM or unrelated state.
   *
   * It may be empty (no selection) or hold one/many ids; `recordId` is derived
   * from it for the single-record compatibility path.
   */
  selectedRecordIds: string[];
  objectNameSingular: string;
};

export const viewableFrontComponentRecordContextComponentState =
  createAtomComponentState<FrontComponentRecordContext | null>({
    key: 'side-panel/viewable-front-component-record-context',
    defaultValue: null,
    componentInstanceContext: SidePanelPageComponentInstanceContext,
  });
