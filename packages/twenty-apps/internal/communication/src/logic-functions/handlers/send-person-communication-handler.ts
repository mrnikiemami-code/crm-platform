import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { SUPPORTED_COMMUNICATION_CHANNELS } from 'src/logic-functions/types/communication-channel-option.type';
import {
  type SendPersonCommunicationFailureCode,
  type SendPersonCommunicationResponse,
} from 'src/logic-functions/types/send-person-communication-input.type';
import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import {
  CommunicationOutcomePersistenceError,
  CommunicationSendAndPersistService,
  CommunicationUnexpectedSendFailureError,
} from 'src/services/communication-send-and-persist.service';
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

const fail = (
  error: string,
  failureCode: SendPersonCommunicationFailureCode,
  extra: Partial<SendPersonCommunicationResponse> = {},
): SendPersonCommunicationResponse => ({
  success: false,
  failureCode,
  ...extra,
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
    return fail(
      `Unsupported channel "${parameters.channel}".`,
      'INVALID_INPUT',
    );
  }

  if (!isNonEmptyString(parameters.body.trim())) {
    return fail('Message body is required.', 'INVALID_INPUT');
  }

  if (!isNonEmptyString(parameters.recipient.trim())) {
    return fail('Recipient is required.', 'INVALID_INPUT');
  }

  const client = dependencies.client ?? new CoreApiClient();

  // Validate Person access server-side and confirm the recipient really
  // belongs to that Person.
  const phoneOptions = await findPersonPhoneOptions({
    client,
    personId: parameters.personId,
  });

  if (phoneOptions === null) {
    return fail('Person not found or not accessible.', 'PERSON_NOT_ACCESSIBLE');
  }

  if (phoneOptions.length === 0) {
    return fail('This person has no phone number.', 'INVALID_INPUT');
  }

  if (!phoneOptions.some((option) => option.value === parameters.recipient)) {
    return fail(
      'Selected phone number does not belong to this person.',
      'INVALID_INPUT',
    );
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

  let communicationId: string;
  let result;

  try {
    ({ communicationId, result } = await orchestration.sendAndPersist({
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
    }));
  } catch (error) {
    // The provider outcome is known for CommunicationOutcomePersistenceError:
    // the send did happen, only history could not be written. Report the real
    // outcome and make clear that retrying would send a duplicate.
    if (error instanceof CommunicationOutcomePersistenceError) {
      const outcome = error.sendResult;

      console.warn(
        '[communication] send outcome could not be persisted',
        JSON.stringify({
          classification: 'OUTCOME_NOT_PERSISTED',
          communicationId: error.communicationId,
          providerOutcome: outcome.status,
        }),
      );

      return {
        success: false,
        status: outcome.status,
        communicationId: error.communicationId,
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: true,
        error:
          outcome.status === 'FAILED'
            ? 'The provider rejected the message and the failure could not be recorded. Do not retry automatically.'
            : 'The message was sent but its result could not be recorded. Do not retry automatically.',
      };
    }

    // Both the send and the FAILED write failed, so the outcome is genuinely
    // unknown. The full causes are logged server-side (never returned, never
    // persisted), and the caller gets a stable classification.
    if (error instanceof CommunicationUnexpectedSendFailureError) {
      console.warn(
        '[communication] unexpected send failure with persistence failure',
        JSON.stringify({
          classification: 'UNEXPECTED_FAILURE',
          communicationId: error.communicationId,
          sendCause:
            error.sendCause instanceof Error
              ? error.sendCause.name
              : 'unknown',
          persistenceCause:
            error.persistenceCause instanceof Error
              ? error.persistenceCause.name
              : 'unknown',
        }),
      );

      return {
        success: false,
        communicationId: error.communicationId,
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error:
          'The message could not be sent and its state could not be recorded. Do not retry automatically.',
      };
    }

    // Configuration, provider or programming failures before/around the
    // orchestration. Raw exception text is never returned to the client.
    console.warn(
      '[communication] send failed',
      JSON.stringify({
        classification: 'UNEXPECTED_FAILURE',
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    );

    return fail('The message could not be sent.', 'UNEXPECTED_FAILURE', {
      isOutcomeKnown: false,
    });
  }

  if (result.status === 'FAILED') {
    return {
      success: false,
      status: 'FAILED',
      communicationId,
      failureCode: 'PROVIDER_FAILED',
      isOutcomeKnown: true,
      error: result.failureReason,
    };
  }

  return {
    success: true,
    status: result.status,
    communicationId,
    message:
      result.status === 'DELIVERED' ? 'Message delivered.' : 'Message sent.',
  };
};
