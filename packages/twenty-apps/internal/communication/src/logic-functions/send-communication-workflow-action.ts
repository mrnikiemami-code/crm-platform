import { defineLogicFunction } from 'twenty-sdk/define';

import { SEND_COMMUNICATION_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// DISABLED ENTRY POINT.
//
// This logic function used to be exposed to Workflow through
// `workflowActionTriggerSettings`. That registration has been REMOVED, and the
// entry handler is now a deterministic refusal, because the native Workflow
// contract cannot surface a failed send as a failed step:
//
//   logic-function.workflow-action.ts:  return { result: result.data || {} };
//   workflow-executor.workspace-service.ts:
//     const isSuccess = isDefined(actionOutput.result);
//     ... isSuccess -> StepStatus.SUCCESS, shouldProcessNextSteps = true
//
// A returned failure was therefore reported as a SUCCESS step and downstream
// steps continued, while throwing instead would arm Twenty's automatic step
// retry and could send the message twice.
//
// The reusable adapter (`sendCommunicationWorkflowHandler`) and its focused
// tests are retained for future work, but nothing here can reach them: this
// entry returns before constructing a client, resolving configuration, or
// calling any service. It performs no provider, persistence, Person or HTTP
// call.
//
// The universal identifier is intentionally unchanged so the app keeps a
// stable identity; only the trigger registration and the handler body differ.
const WORKFLOW_ACTION_DISABLED_RESULT = {
  success: false,
  failureCode: 'WORKFLOW_ACTION_DISABLED',
  error: 'Communication sending from Workflow is unavailable.',
} as const;

const handler = async (): Promise<typeof WORKFLOW_ACTION_DISABLED_RESULT> =>
  WORKFLOW_ACTION_DISABLED_RESULT;

export default defineLogicFunction({
  universalIdentifier:
    SEND_COMMUNICATION_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-send-workflow-action',
  description:
    'Disabled. Communication sending from Workflow is unavailable because a failed send cannot be reported as a failed step.',
  timeoutSeconds: 30,
  handler,
  // No `workflowActionTriggerSettings`, and deliberately no alternative HTTP,
  // tool or database trigger: this function must not be callable as a sending
  // entry point.
});
