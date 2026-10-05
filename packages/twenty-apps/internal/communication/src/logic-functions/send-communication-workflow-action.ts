import { defineLogicFunction } from 'twenty-sdk/define';

import { SEND_COMMUNICATION_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendCommunicationWorkflowHandler } from 'src/logic-functions/handlers/send-communication-workflow-handler';
import {
  SEND_COMMUNICATION_WORKFLOW_INPUT_SCHEMA,
  type SendCommunicationWorkflowRequest,
} from 'src/logic-functions/types/send-communication-workflow-input.type';
import { jsonSchemaToInputSchema } from 'src/logic-functions/utils/json-schema-to-input-schema';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

type LogicFunctionContext = {
  workspaceMemberId: string | null;
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const handler = async (
  payload: SendCommunicationWorkflowRequest | null,
  context?: LogicFunctionContext,
) => {
  const channel = readString(payload?.channel);
  const recipient = readString(payload?.recipient);
  const body = typeof payload?.body === 'string' ? payload.body : undefined;

  if (channel === undefined || recipient === undefined || body === undefined) {
    return {
      success: false,
      failureCode: 'INVALID_INPUT',
      error: '`channel`, `recipient` and `body` are required.',
    };
  }

  return sendCommunicationWorkflowHandler({
    channel,
    recipient,
    body,
    ...(readString(payload?.subject) === undefined
      ? {}
      : { subject: readString(payload?.subject) as string }),
    ...(readString(payload?.providerId) === undefined
      ? {}
      : { providerId: readString(payload?.providerId) as CommunicationProviderId }),
    ...(readString(payload?.targetPersonId) === undefined
      ? {}
      : { targetPersonId: readString(payload?.targetPersonId) as string }),
    // Trusted, server-resolved sender. May be null for a run with no human
    // behind it; no member is fabricated.
    workspaceMemberId: context?.workspaceMemberId ?? null,
  });
};

export default defineLogicFunction({
  universalIdentifier:
    SEND_COMMUNICATION_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-send-workflow-action',
  description: 'Send an outbound communication to a recipient.',
  timeoutSeconds: 30,
  handler,
  workflowActionTriggerSettings: {
    label: 'Send Communication',
    icon: 'IconSend',
    inputSchema: jsonSchemaToInputSchema(
      SEND_COMMUNICATION_WORKFLOW_INPUT_SCHEMA,
    ),
    outputSchema: [
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          status: { type: 'string' },
          communicationId: { type: 'string' },
          failureCode: { type: 'string' },
          isOutcomeKnown: { type: 'boolean' },
          message: { type: 'string' },
          error: { type: 'string' },
        },
      },
    ],
  },
});
