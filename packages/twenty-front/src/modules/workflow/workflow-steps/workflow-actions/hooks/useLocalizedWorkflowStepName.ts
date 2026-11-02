import { getLocalizedWorkflowStepName } from '@/workflow/workflow-steps/workflow-actions/utils/getLocalizedWorkflowStepName';

export const useLocalizedWorkflowStepName = (
  name: string | undefined,
): string => getLocalizedWorkflowStepName(name);
