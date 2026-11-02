import { ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL } from '@/workflow/workflow-steps/workflow-actions/constants/ActionLabelMessages';
import { type I18n } from '@lingui/core';

// A step's `name` is persisted by the server from the action's technical
// default label; translate it only for display so stored values stay stable.
export const getLocalizedWorkflowStepName = (
  name: string | undefined,
  i18n: I18n,
): string => {
  if (!name) {
    return '';
  }

  const messageDescriptor = ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL[name];

  return messageDescriptor ? i18n._(messageDescriptor) : name;
};
