import { defineLogicFunction } from 'twenty-sdk/define';

import { SEND_TEMPLATE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendTemplateSmsFromWorkflow } from 'src/workflow/send-template-sms.service';

// Workflow step: send a SAVED SMS template to the Person a changed record
// resolves to.
//
// Contract notes that shaped this entry point:
//  - The recipient is NEVER an input. It comes from the record's real relation,
//    resolved server-side, so a workflow author cannot type a phone number.
//  - Success/failure must not be reported as a success. The executor maps a
//    RETURNED value to StepStatus.SUCCESS and a THROWN error to StepStatus.FAILED
//    (`logic-function.workflow-action.ts`). A returned `{ success: false }` would
//    therefore be presented as a successful step, so every non-send THROWS.
//    Automatic replay is still safe because the send is deduplicated by a
//    deterministic record id, and step retry defaults to zero.
//  - `workflowId` and `fieldName` are supplied by the trigger variables, not
//    typed by the author, so they stay accurate if the workflow is renamed.
type SendTemplateWorkflowPayload = {
  templateId?: unknown;
  sourceObjectNameSingular?: unknown;
  sourceRecordId?: unknown;
  fieldName?: unknown;
  beforeValue?: unknown;
  afterValue?: unknown;
  workflowId?: unknown;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const handler = async (payload: SendTemplateWorkflowPayload) => {
  const request = payload ?? {};

  const result = await sendTemplateSmsFromWorkflow({
    templateId: asString(request.templateId),
    sourceObjectNameSingular: asString(request.sourceObjectNameSingular),
    sourceRecordId: asString(request.sourceRecordId),
    fieldName: asString(request.fieldName),
    beforeValue: request.beforeValue,
    afterValue: request.afterValue,
    workflowId: asString(request.workflowId),
  });

  if (!result.success) {
    // Thrown so the workflow step is FAILED, never a false success. The code is
    // prefixed for the step log; the message already explains the situation to
    // an operator without exposing customer data.
    throw new Error(
      `[${result.failureCode ?? 'SEND_FAILED'}] ${result.error ?? 'The message was not sent.'}`,
    );
  }

  return {
    success: true,
    outcome: result.outcome,
    communicationId: result.communicationId ?? null,
    message: result.message ?? 'Message sent.',
  };
};

export default defineLogicFunction({
  universalIdentifier: SEND_TEMPLATE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-send-template-workflow-action',
  description:
    'Send a saved SMS template to the Person a changed record resolves to. Sends at most once per real field change.',
  timeoutSeconds: 30,
  handler,
  // Exposed to the visual workflow builder as "Send SMS from template".
  workflowActionTriggerSettings: {
    label: 'Send SMS from template',
    icon: 'IconMessage',
    inputSchema: [
      {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            label: 'SMS template',
            // Filled from the source-scoped template list by the builder, or by
            // the operator pasting a template id. A removed or foreign template
            // is rejected at send time.
          },
          sourceObjectNameSingular: {
            type: 'string',
            label: 'Record object (nameSingular)',
          },
          sourceRecordId: {
            type: 'string',
            label: 'Record id',
          },
          fieldName: {
            type: 'string',
            label: 'Watched field (name)',
          },
          beforeValue: {
            type: 'unknown',
            label: 'Value before the change',
          },
          afterValue: {
            type: 'unknown',
            label: 'Value after the change',
          },
          workflowId: {
            type: 'string',
            label: 'Workflow id',
          },
        },
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          outcome: { type: 'string' },
          communicationId: { type: 'string' },
          message: { type: 'string' },
        },
      },
    ],
  },
});
