import { getLocalizedWorkflowStepName } from '@/workflow/workflow-steps/workflow-actions/utils/getLocalizedWorkflowStepName';
import { useLingui } from '@lingui/react';

export const useLocalizedWorkflowStepName = (
  name: string | undefined,
): string => {
  const { i18n } = useLingui();

  return getLocalizedWorkflowStepName(name, i18n);
};
