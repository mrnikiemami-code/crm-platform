import { ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL } from '@/workflow/workflow-steps/workflow-actions/constants/ActionLabelMessages';
import { i18n } from '@lingui/core';
import { isDefined } from 'twenty-shared/utils';

// A step's `name` is persisted by the server from the action's technical
// default label; translate it only for display so stored values stay stable.
// The active i18n instance is read here rather than through a hook so the
// helper also works in components rendered outside an I18nProvider (tests).
export const getLocalizedWorkflowStepName = (
  name: string | undefined,
): string => {
  if (!isDefined(name) || name === '') {
    return '';
  }

  const messageDescriptor = ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL[name];

  return isDefined(messageDescriptor) ? i18n._(messageDescriptor) : name;
};
