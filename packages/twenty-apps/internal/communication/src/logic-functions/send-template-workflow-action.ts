import { defineLogicFunction } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  SEND_TEMPLATE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
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
//  - `eventId` is the identity of the WRITE, not of the record. It is what makes
//    "the same event replayed" and "the same field changed back" different
//    things, so a repeat of one real change sends once while a genuinely new
//    change still sends.
type SendTemplateWorkflowPayload = {
  templateId?: unknown;
  sourceObjectNameSingular?: unknown;
  sourceRecordId?: unknown;
  fieldName?: unknown;
  beforeValue?: unknown;
  afterValue?: unknown;
  eventId?: unknown;
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
    eventId: asString(request.eventId),
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
  // Exposed to the visual workflow builder as "ارسال پیامک از الگو".
  workflowActionTriggerSettings: {
    label: 'ارسال پیامک از الگو',
    icon: 'IconMessage',
    // The author only chooses a template. The trigger-supplied values below are
    // declared (a property absent from the schema never reaches the function)
    // but hidden, and the builder fills them from the workflow trigger.
    // Hiding the expected-output box removes the last developer-facing field.
    hideExpectedOutput: true,
    triggerRequirementMessage:
      'برای ارسال پیامک هنگام تغییر اطلاعات، رویداد «ویرایش رکورد» و ستون موردنظر را انتخاب کنید.',
    inputSchema: [
      {
        type: 'object',
        properties: {
          // Declared as a RECORD of the template object, not as free text. The
          // builder then renders the platform's own record picker scoped to
          // messageTemplate rows, showing each template's TITLE and storing its
          // id — so an operator selects a Persian template name and never types
          // a UUID.
          templateId: {
            type: 'record',
            objectUniversalIdentifier:
              MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
            label: 'الگوی پیامک',
          },
          sourceObjectNameSingular: {
            type: 'string',
            label: 'نام موجودیت رکورد',
            isHidden: true,
            derivedFromTrigger: 'objectName',
          },
          sourceRecordId: {
            type: 'string',
            label: 'شناسه رکورد',
            isHidden: true,
            derivedFromTrigger: 'recordId',
          },
          fieldName: {
            type: 'string',
            label: 'ستون تغییرکرده',
            isHidden: true,
            derivedFromTrigger: 'watchedField',
          },
          beforeValue: {
            type: 'unknown',
            label: 'مقدار قبل از تغییر',
            isHidden: true,
            derivedFromTrigger: 'beforeValue',
          },
          afterValue: {
            type: 'unknown',
            label: 'مقدار بعد از تغییر',
            isHidden: true,
            derivedFromTrigger: 'afterValue',
          },
          // The write identity. Mapping it is what allows A→B→A to send twice
          // while a replay of one event still sends once; without it the step
          // falls back to a value-based key that can suppress that repeat.
          eventId: {
            type: 'string',
            label: 'شناسه رویداد',
            isHidden: true,
            derivedFromTrigger: 'eventId',
          },
          workflowId: {
            type: 'string',
            label: 'شناسه گردش کار',
            isHidden: true,
            derivedFromTrigger: 'workflowId',
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
