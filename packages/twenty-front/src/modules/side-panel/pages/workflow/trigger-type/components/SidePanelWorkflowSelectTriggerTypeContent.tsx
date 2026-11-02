import { useSidePanelWorkflowNavigation } from '@/side-panel/pages/workflow/hooks/useSidePanelWorkflowNavigation';
import { useSidePanelWorkflowIdOrThrow } from '@/side-panel/pages/workflow/hooks/useSidePanelWorkflowIdOrThrow';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useFlowOrThrow } from '@/workflow/hooks/useFlowOrThrow';
import {
  type WorkflowTrigger,
  type WorkflowTriggerType,
} from '@/workflow/types/Workflow';
import { workflowSelectedNodeComponentState } from '@/workflow/workflow-diagram/states/workflowSelectedNodeComponentState';
import { SidePanelStepListContainer } from '@/workflow/workflow-steps/components/SidePanelWorkflowSelectStepContainer';
import { SidePanelWorkflowSelectStepTitle } from '@/workflow/workflow-steps/components/SidePanelWorkflowSelectStepTitle';
import { DATABASE_TRIGGER_TYPES } from '@/workflow/workflow-trigger/constants/DatabaseTriggerTypes';
import { OTHER_TRIGGER_TYPES } from '@/workflow/workflow-trigger/constants/OtherTriggerTypes';
import { TRIGGER_LABEL_MESSAGE_BY_DEFAULT_LABEL } from '@/workflow/workflow-trigger/constants/TriggerLabelMessages';
import { useUpdateWorkflowVersionTrigger } from '@/workflow/workflow-trigger/hooks/useUpdateWorkflowVersionTrigger';
import { getTriggerDefaultDefinition } from '@/workflow/workflow-trigger/utils/getTriggerDefaultDefinition';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { isDefined } from 'twenty-shared/utils';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';
import { useIcons } from 'twenty-ui/icon';
import { useContext } from 'react';
import { MenuItem } from 'twenty-ui/primitives/navigation';
import { ThemeContext } from 'twenty-ui/theme-constants';

export const SidePanelWorkflowSelectTriggerTypeContent = () => {
  const { theme } = useContext(ThemeContext);
  const { getIcon } = useIcons();
  const { i18n } = useLingui();
  const workflowId = useSidePanelWorkflowIdOrThrow();
  const { updateTrigger } = useUpdateWorkflowVersionTrigger();

  const { activeNonSystemObjectMetadataItems } =
    useFilteredObjectMetadataItems();

  const setWorkflowSelectedNode = useSetAtomComponentState(
    workflowSelectedNodeComponentState,
  );
  const { openWorkflowEditStepInSidePanel } = useSidePanelWorkflowNavigation();
  const flow = useFlowOrThrow();

  const handleTriggerTypeClick = ({
    type,
    defaultLabel,
    icon,
  }: {
    type: WorkflowTriggerType;
    defaultLabel: string;
    icon: string;
  }) => {
    return async () => {
      const localizedLabel = i18n._(
        TRIGGER_LABEL_MESSAGE_BY_DEFAULT_LABEL[defaultLabel] ?? defaultLabel,
      );

      let updatedTrigger: WorkflowTrigger | null = getTriggerDefaultDefinition({
        defaultLabel,
        type,
        name: localizedLabel,
        activeNonSystemObjectMetadataItems,
      });

      if (isDefined(flow.trigger)) {
        updatedTrigger = {
          ...updatedTrigger,
          position: flow.trigger.position,
          nextStepIds: flow.trigger.nextStepIds,
        };
      }

      await updateTrigger(updatedTrigger);

      setWorkflowSelectedNode(TRIGGER_STEP_ID);

      openWorkflowEditStepInSidePanel({
        workflowId,
        title: localizedLabel,
        icon: getIcon(icon),
        stepId: TRIGGER_STEP_ID,
      });
    };
  };

  const getLocalizedLabel = (defaultLabel: string): string =>
    i18n._(TRIGGER_LABEL_MESSAGE_BY_DEFAULT_LABEL[defaultLabel] ?? defaultLabel);

  return (
    <SidePanelStepListContainer>
      <SidePanelWorkflowSelectStepTitle>
        {t`Data`}
      </SidePanelWorkflowSelectStepTitle>
      {DATABASE_TRIGGER_TYPES.map((action) => {
        const Icon = getIcon(action.icon);
        const label = getLocalizedLabel(action.defaultLabel);

        return (
          <MenuItem
            withIconContainer={true}
            key={action.defaultLabel}
            LeftIcon={() => <Icon color={theme.color.blue} size={16} />}
            text={label}
            onClick={handleTriggerTypeClick(action)}
          />
        );
      })}

      <SidePanelWorkflowSelectStepTitle>
        {t`Others`}
      </SidePanelWorkflowSelectStepTitle>
      {OTHER_TRIGGER_TYPES.map((action) => {
        const Icon = getIcon(action.icon);
        const label = getLocalizedLabel(action.defaultLabel);

        return (
          <MenuItem
            withIconContainer={true}
            key={action.defaultLabel}
            LeftIcon={() => <Icon color={theme.color.purple} size={16} />}
            text={label}
            onClick={handleTriggerTypeClick(action)}
          />
        );
      })}
    </SidePanelStepListContainer>
  );
};
