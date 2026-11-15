import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEND_PERSON_COMMUNICATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendPersonCommunicationHandler } from 'src/logic-functions/handlers/send-person-communication-handler';
import { type SendPersonCommunicationRequest } from 'src/logic-functions/types/send-person-communication-input.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { checkSendMessagePermission } from 'src/settings/settings-permission';

type LogicFunctionContext = {
  workspaceMemberId: string | null;
};

/**
 * Exported for the route-authorization test: the guard has to be verifiable at
 * the entry point, because that is the surface a direct caller reaches.
 */
export const handler = async (
  event: RoutePayload<SendPersonCommunicationRequest>,
  context?: LogicFunctionContext,
) => {
  // Authorization comes FIRST, before the body is even inspected: whether the
  // caller may message a customer is a different question from whether they can
  // read that customer, and a member with record access but no send permission
  // must not be able to dispatch anything. The check is server-side against the
  // caller's own workspace permissions, so calling this route directly cannot
  // bypass it.
  const permission = await checkSendMessagePermission();

  if (!permission.allowed) {
    // One sanitized refusal; the reason (no user context vs. not permitted) is
    // not disclosed.
    return {
      success: false,
      failureCode: 'NOT_PERMITTED' as const,
      error: 'You do not have permission to send messages.',
    };
  }

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

  const readOptionalString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const contextObjectName = readOptionalString(body.contextObjectName);
  const contextRecordId = readOptionalString(body.contextRecordId);
  const isContextual = contextObjectName !== null && contextRecordId !== null;

  // `personId` is required EXCEPT for a contextual send, where the recipient is
  // derived from the record and a client-supplied id is deliberately ignored.
  // Requiring one there would force the client to name a person it is not
  // allowed to choose.
  if (personId.length === 0 && !isContextual) {
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
    // The record context, forwarded so the handler can derive the recipient and
    // the source values from the record itself. These are NOT trusted as values:
    // they are identifiers that are re-resolved against live metadata, and the
    // record's own recipient wins over `personId` above.
    contextObjectName,
    contextRecordId,
    contextRelationUid: readOptionalString(body.contextRelationUid),
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
