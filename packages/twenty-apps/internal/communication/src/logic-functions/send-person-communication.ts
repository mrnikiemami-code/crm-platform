import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEND_PERSON_COMMUNICATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendPersonCommunicationHandler } from 'src/logic-functions/handlers/send-person-communication-handler';
import { type SendPersonCommunicationRequest } from 'src/logic-functions/types/send-person-communication-input.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';

type LogicFunctionContext = {
  workspaceMemberId: string | null;
};

const handler = async (
  event: RoutePayload<SendPersonCommunicationRequest>,
  context?: LogicFunctionContext,
) => {
  const body = event.body;

  if (body === null || typeof body !== 'object') {
    return { success: false, error: 'A JSON body is required.' };
  }

  const personId = typeof body.personId === 'string' ? body.personId.trim() : '';
  const channel = typeof body.channel === 'string' ? body.channel : '';
  const recipient =
    typeof body.recipient === 'string' ? body.recipient.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body : '';
  const subject = typeof body.subject === 'string' ? body.subject : undefined;

  if (personId.length === 0) {
    return { success: false, error: '`personId` is required.' };
  }

  if (channel.length === 0) {
    return { success: false, error: '`channel` is required.' };
  }

  return sendPersonCommunicationHandler({
    personId,
    channel: channel as CommunicationChannel,
    recipient,
    body: messageBody,
    ...(subject === undefined ? {} : { subject }),
    // Trusted, server-resolved sender. The client never supplies this.
    workspaceMemberId: context?.workspaceMemberId ?? null,
  });
};

export default defineLogicFunction({
  universalIdentifier:
    SEND_PERSON_COMMUNICATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-send-message',
  description: 'Sends an outbound communication to a person.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
