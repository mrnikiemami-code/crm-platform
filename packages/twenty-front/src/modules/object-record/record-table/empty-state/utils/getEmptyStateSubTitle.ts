import { CoreObjectNameSingular } from 'twenty-shared/types';
import { t } from '@lingui/core/macro';

// Communication records are written by the app's send flow, never by hand, so
// the generic "add your first … manually" guidance would be misleading.
const COMMUNICATION_OBJECT_NAME_SINGULAR = 'communication';

export const getEmptyStateSubTitle = (
  objectNameSingular: string,
  objectLabel: string,
) => {
  if (objectNameSingular === COMMUNICATION_OBJECT_NAME_SINGULAR) {
    return t`Send an SMS from a person's page to record it here.`;
  }

  if (objectNameSingular === CoreObjectNameSingular.WorkflowVersion) {
    return t`Create a workflow and return here to view its versions`;
  }

  if (objectNameSingular === CoreObjectNameSingular.WorkflowRun) {
    return t`Run a workflow and return here to view its executions`;
  }

  return t`Use our API or add your first ${objectLabel} manually`;
};
