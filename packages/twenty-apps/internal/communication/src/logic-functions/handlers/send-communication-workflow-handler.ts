import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { type SendCommunicationWorkflowResult } from 'src/logic-functions/types/send-communication-workflow-input.type';
import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { validateCommunicationRequest } from 'src/services/communication-request-validation';
import {
  CommunicationOutcomePersistenceError,
  CommunicationSendAndPersistService,
  CommunicationUnexpectedSendFailureError,
} from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';

export type SendCommunicationWorkflowParameters = {
  channel: string;
  recipient: string;
  body: string;
  subject?: string;
  providerId?: CommunicationProviderId;
  /** Optional Person context; validated server-side when supplied. */
  targetPersonId?: string;
  /**
   * Workspace member resolved from the trusted execution context. Never
   * supplied by the Workflow author. It may be absent: a Workflow can run with
   * no human behind it, and no member is fabricated in that case.
   */
  workspaceMemberId?: string | null;
};

export type SendCommunicationWorkflowDependencies = {
  client?: CoreApiClient;
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
};

const fail = (
  error: string,
  failureCode: string,
  extra: Partial<SendCommunicationWorkflowResult> = {},
): SendCommunicationWorkflowResult => ({
  success: false,
  failureCode,
  ...extra,
  error,
});

/**
 * Workflow entry point for outbound communication.
 *
 * It is a thin adapter: validate and map inputs, then delegate to the same
 * certified durable send service the Person composer uses. It never calls an
 * HTTP route, never reuses the composer as a backend, never talks to a
 * provider directly, and contains no provider-specific branching.
 */
export const sendCommunicationWorkflowHandler = async (
  parameters: SendCommunicationWorkflowParameters,
  dependencies: SendCommunicationWorkflowDependencies = {},
): Promise<SendCommunicationWorkflowResult> => {
  // The same validation the composer route enforces.
  const validation = validateCommunicationRequest({
    channel: parameters.channel,
    recipient: parameters.recipient,
    body: parameters.body,
  });

  if (!validation.success) {
    return fail(validation.error, 'INVALID_INPUT');
  }

  const channel: CommunicationChannel = validation.channel;
  const recipient = parameters.recipient.trim();

  const client = dependencies.client ?? new CoreApiClient();

  // A supplied Person is validated server-side, exactly as the composer route
  // does: access plus recipient ownership.
  if (isNonEmptyString(parameters.targetPersonId)) {
    const phoneOptions = await findPersonPhoneOptions({
      client,
      personId: parameters.targetPersonId,
    });

    if (phoneOptions === null) {
      return fail('Person not found or not accessible.', 'PERSON_NOT_ACCESSIBLE');
    }

    if (!phoneOptions.some((option) => option.value === recipient)) {
      return fail(
        'Selected phone number does not belong to this person.',
        'INVALID_INPUT',
      );
    }
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
        channel,
        recipient,
        body: parameters.body,
        // Single source of truth for the outbound subject.
        ...(isNonEmptyString(subject) ? { subject } : {}),
      },
      ...(isNonEmptyString(parameters.targetPersonId)
        ? { targetPersonId: parameters.targetPersonId }
        : {}),
      ...(isNonEmptyString(parameters.providerId)
        ? { providerId: parameters.providerId }
        : {}),
      ...(isNonEmptyString(parameters.workspaceMemberId)
        ? { senderId: parameters.workspaceMemberId }
        : {}),
    }));
  } catch (error) {
    // The provider outcome is known: the send happened, only history could not
    // be written. Report the real outcome and warn against re-running.
    if (error instanceof CommunicationOutcomePersistenceError) {
      const outcome = error.sendResult;

      console.warn(
        '[communication] workflow send outcome could not be persisted',
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
            ? 'The provider rejected the message and the failure could not be recorded. Re-running this step would send it again.'
            : 'The message was sent but its result could not be recorded. Re-running this step would send it again.',
      };
    }

    // Both the send and the FAILED write failed, so the outcome is unknown.
    if (error instanceof CommunicationUnexpectedSendFailureError) {
      console.warn(
        '[communication] workflow unexpected send failure with persistence failure',
        JSON.stringify({
          classification: 'UNEXPECTED_FAILURE',
          communicationId: error.communicationId,
          sendCause:
            error.sendCause instanceof Error ? error.sendCause.name : 'unknown',
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
          'The send outcome is unknown. Check the communication history before re-running this step.',
      };
    }

    // This catch also covers an unexpected provider throw followed by a
    // SUCCESSFUL FAILED-state write. A definite non-send therefore cannot be
    // inferred: the failure may have happened after the provider accepted the
    // message. Only uncertainty is truthful.
    console.warn(
      '[communication] workflow send failed',
      JSON.stringify({
        classification: 'UNEXPECTED_FAILURE',
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    );

    return {
      success: false,
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
      error:
        'The message may or may not have been sent. Check the communication history before re-running this step.',
    };
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
