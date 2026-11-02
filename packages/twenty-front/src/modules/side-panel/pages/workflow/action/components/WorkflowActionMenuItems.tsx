import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL } from '@/workflow/workflow-steps/workflow-actions/constants/ActionLabelMessages';
import { getActionIconColorOrThrow } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIconColorOrThrow';
import { useLingui } from '@lingui/react';
import { useIcons } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/primitives/navigation';

type Action = {
  defaultLabel: string;
  type: WorkflowActionType;
  icon: string;
};

export const WorkflowActionMenuItems = ({
  actions,
  onClick,
}: {
  actions: Action[];
  onClick: (actionType: WorkflowActionType) => void;
}) => {
  const { getIcon } = useIcons();
  const { i18n } = useLingui();

  return (
    <>
      {actions.map((action) => {
        const Icon = getIcon(action.icon);
        const messageDescriptor =
          ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL[action.defaultLabel];

        return (
          <MenuItem
            withIconContainer={true}
            key={action.type}
            LeftIcon={() => (
              <Icon color={getActionIconColorOrThrow(action.type)} size={16} />
            )}
            text={
              messageDescriptor
                ? i18n._(messageDescriptor)
                : action.defaultLabel
            }
            onClick={() => onClick(action.type)}
          />
        );
      })}
    </>
  );
};
