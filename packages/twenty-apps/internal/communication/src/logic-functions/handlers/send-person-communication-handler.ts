import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { SUPPORTED_COMMUNICATION_CHANNELS } from 'src/logic-functions/types/communication-channel-option.type';
import { type SendPersonCommunicationResponse } from 'src/logic-functions/types/send-person-communication-input.type';
import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { CommunicationSendAndPersistService } from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';

export type SendPersonCommunicationParameters = {
  personId: string;
  channel: CommunicationChannel;
  /** Exact destination chosen by the caller. */
  recipient: string;
  body: string;
  subject?: string;
  /**
   * Server-resolved workspace member of the triggering user. Never accepted
   * from the client; supplied by the trusted logic-function execution context.
   */
  workspaceMemberId?: string | null;
};

export type SendPersonCommunicationDependencies = {
  /**
   * Workspace API client. Defaults to the app runtime's `CoreApiClient`; tests
   * inject a fake so validation and orchestration can be exercised without a
   * live workspace.
   */
  client?: CoreApiClient;
  /** Provider registry override; tests inject stub providers. */
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
};

const fail = (error: string): SendPersonCommunicationResponse => ({
  success: false,
  error,
});

// Orchestrates one Person outbound communication. It validates input and
// Person access, then delegates to the same certified durable path the UI and
// future Workflow will share. It never talks to a provider directly.
export const sendPersonCommunicationHandler = async (
  parameters: SendPersonCommunicationParameters,
  dependencies: SendPersonCommunicationDependencies = {},
): Promise<SendPersonCommunicationResponse> => {
  if (!SUPPORTED_COMMUNICATION_CHANNELS.includes(parameters.channel)) {
    return fail(`Unsupported channel "${parameters.channel}".`);
  }

  if (!isNonEmptyString(parameters.body.trim())) {
    return fail('Message body is required.');
  }

  if (!isNonEmptyString(parameters.recipient.trim())) {
    return fail('Recipient is required.');
  }

  const client = dependencies.client ?? new CoreApiClient();

  // Validate Person access server-side and confirm the recipient really
  // belongs to that Person.
  const phoneOptions = await findPersonPhoneOptions({
    client,
    personId: parameters.personId,
  });

  if (phoneOptions === null) {
    return fail('Person not found or not accessible.');
  }

  if (phoneOptions.length === 0) {
    return fail('This person has no phone number.');
  }

  if (!phoneOptions.some((option) => option.value === parameters.recipient)) {
    return fail('Selected phone number does not belong to this person.');
  }

  const registry =
    dependencies.registry ?? createCommunicationProviderRegistry();
  const sendService = new CommunicationSendService(registry);
  const persistence = new CoreApiCommunicationPersistence(client);
  const orchestration = new CommunicationSendAndPersistService(
    sendService,
    persistence,
  );

  const subject = parameters.subject?.trim();

  try {
    const { communicationId, result } = await orchestration.sendAndPersist({
      message: {
        channel: parameters.channel,
        recipient: parameters.recipient,
        body: parameters.body,
        ...(isNonEmptyString(subject) ? { subject } : {}),
      },
      targetPersonId: parameters.personId,
      ...(isNonEmptyString(parameters.workspaceMemberId)
        ? { senderId: parameters.workspaceMemberId }
        : {}),
    });

    if (result.status === 'FAILED') {
      return {
        success: false,
        status: 'FAILED',
        communicationId,
        error: result.failureReason,
      };
    }

    return {
      success: true,
      status: result.status,
      communicationId,
      message:
        result.status === 'DELIVERED'
          ? 'Message delivered.'
          : 'Message sent.',
    };
  } catch {
    // Configuration, provider or persistence failures are surfaced as a safe
    // application failure. Raw exception text is never returned to the client.
    return fail('The message could not be sent.');
  }
};
