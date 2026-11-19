import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEND_OUTBOUND_MESSAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendOutboundMessageHandler } from 'src/logic-functions/handlers/send-outbound-message-handler';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

type SendOutboundMessageRequest = {
  channel?: unknown;
  providerId?: unknown;
  recipient?: unknown;
  body?: unknown;
  targetPersonId?: unknown;
  sourceRecordId?: unknown;
};

// Nest quotation share (and similar bridges) call this route so outbound
// traffic still goes through Provider Registry + Send/Persist. Product
// permissions (quotation.send) are enforced by the Nest caller; this route
// only requires an authenticated workspace principal (user or API key).
const handler = async (event: RoutePayload<SendOutboundMessageRequest>) => {
  const body = event.body;

  if (body === null || typeof body !== 'object') {
    return {
      success: false,
      failureCode: 'INVALID_INPUT' as const,
      error: 'A JSON body is required.',
    };
  }

  const channel = typeof body.channel === 'string' ? body.channel.trim() : '';
  const providerId =
    typeof body.providerId === 'string' ? body.providerId.trim() : '';
  const recipient =
    typeof body.recipient === 'string' ? body.recipient.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body : '';
  const targetPersonId =
    typeof body.targetPersonId === 'string' ? body.targetPersonId.trim() : null;
  const sourceRecordId =
    typeof body.sourceRecordId === 'string' ? body.sourceRecordId.trim() : null;

  if (channel === '' || providerId === '') {
    return {
      success: false,
      failureCode: 'INVALID_INPUT' as const,
      error: 'channel and providerId are required.',
    };
  }

  return sendOutboundMessageHandler({
    channel: channel as CommunicationChannel,
    providerId: providerId as CommunicationProviderId,
    recipient,
    body: messageBody,
    targetPersonId,
    sourceRecordId,
  });
};

export default defineLogicFunction({
  universalIdentifier: SEND_OUTBOUND_MESSAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-outbound-message',
  description:
    'Provider-registry outbound send via Send/Persist (used by quotation Bale share).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/send-outbound-message',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
