import { isNonEmptyString } from '@sniptt/guards';

import { SUPPORTED_COMMUNICATION_CHANNELS } from 'src/logic-functions/types/communication-channel-option.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';

export type CommunicationRequestValidation =
  | { success: true; channel: CommunicationChannel }
  | { success: false; error: string };

/**
 * Shared input validation for every Communication entry point (the Person
 * composer route and the Workflow action). It enforces the same channel
 * allow-list and required fields, so no entry point can bypass the rules the
 * other enforces.
 */
export const validateCommunicationRequest = ({
  channel,
  recipient,
  body,
}: {
  channel: string;
  recipient: string;
  body: string;
}): CommunicationRequestValidation => {
  if (!SUPPORTED_COMMUNICATION_CHANNELS.includes(channel as never)) {
    return {
      success: false,
      error: `Unsupported channel "${channel}".`,
    };
  }

  if (!isNonEmptyString(body.trim())) {
    return { success: false, error: 'Message body is required.' };
  }

  if (!isNonEmptyString(recipient.trim())) {
    return { success: false, error: 'Recipient is required.' };
  }

  return { success: true, channel: channel as CommunicationChannel };
};
