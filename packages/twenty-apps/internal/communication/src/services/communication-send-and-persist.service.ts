import {
  type CommunicationPersistence,
  type CommunicationRecordOutcome,
} from 'src/persistence/communication-persistence.port';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import {
  type CommunicationSendService,
  getConfiguredProviderId,
} from 'src/services/communication-send.service';
import { type SendCommunicationInput } from 'src/services/send-communication-input.type';

export type SendAndPersistResult = {
  communicationId: string;
  result: CommunicationSendResult;
};

// Raised when the provider returned a result but that outcome could not be
// recorded. The wording is outcome-neutral on purpose: a normalized `FAILED`
// result was never "sent", so claiming delivery here would be false.
//
// The message never carries the persistence error's own text (which could hold
// a credential-bearing payload); the cause is kept only as a non-persisted
// diagnostic property.
export class CommunicationOutcomePersistenceError extends Error {
  readonly communicationId: string;
  readonly sendResult: CommunicationSendResult;
  /** Underlying persistence failure, kept for diagnostics only. */
  readonly persistenceCause: unknown;

  constructor({
    communicationId,
    sendResult,
    cause,
  }: {
    communicationId: string;
    sendResult: CommunicationSendResult;
    cause: unknown;
  }) {
    super(
      `The send outcome for communication ${communicationId} could not be persisted.`,
    );
    this.name = 'CommunicationOutcomePersistenceError';
    this.communicationId = communicationId;
    this.sendResult = sendResult;
    this.persistenceCause = cause;
  }
}

// Raised when the provider call threw unexpectedly AND marking the record
// FAILED also failed. Both facts are preserved as diagnostic properties so
// neither is silently lost, while the durable record may still read QUEUED.
// The message is stable and carries no raw exception text.
export class CommunicationUnexpectedSendFailureError extends Error {
  readonly communicationId: string;
  /** The original unexpected provider/transport error. */
  readonly sendCause: unknown;
  /** The failure encountered while trying to persist the FAILED state. */
  readonly persistenceCause: unknown;

  constructor({
    communicationId,
    sendCause,
    persistenceCause,
  }: {
    communicationId: string;
    sendCause: unknown;
    persistenceCause: unknown;
  }) {
    super(
      `Communication ${communicationId} failed unexpectedly and its FAILED state could not be persisted.`,
    );
    this.name = 'CommunicationUnexpectedSendFailureError';
    this.communicationId = communicationId;
    this.sendCause = sendCause;
    this.persistenceCause = persistenceCause;
  }
}

const buildOutcome = ({
  result,
  now,
}: {
  result: CommunicationSendResult;
  now: string;
}): CommunicationRecordOutcome => {
  switch (result.status) {
    case 'SENT':
      return {
        status: 'SENT',
        sentAt: now,
        providerMessageId: result.providerMessageId,
      };
    case 'DELIVERED':
      return {
        status: 'DELIVERED',
        sentAt: now,
        deliveredAt: now,
        providerMessageId: result.providerMessageId,
      };
    case 'FAILED':
      return {
        status: 'FAILED',
        failureReason: result.failureReason,
        providerMessageId: null,
      };
  }
};

// The single durable outbound path. It is the reusable entry point for the
// Person UI and Workflow, so no caller should ever implement persistence and
// sending separately.
//
// It is provider-agnostic: provider selection comes from the input or from
// configuration, and there is no `switch (provider)` / `if (channel === ...)`.
export class CommunicationSendAndPersistService {
  constructor(
    private readonly sendService: CommunicationSendService,
    private readonly persistence: CommunicationPersistence,
    /** Injected clock so tests are deterministic. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sendAndPersist(
    input: SendCommunicationInput,
  ): Promise<SendAndPersistResult> {
    const providerId = input.providerId ?? getConfiguredProviderId();

    // Persist the attempt first. A message that cannot be durably recorded must
    // not be sent, so a failure here propagates before any provider call.
    const communicationId = await this.persistence.createQueued({
      channel: input.message.channel,
      providerId,
      recipient: input.message.recipient,
      body: input.message.body,
      // Snapshot exactly the subject handed to the provider.
      ...(input.message.subject === undefined
        ? {}
        : { subject: input.message.subject }),
      ...(input.targetPersonId === undefined
        ? {}
        : { targetPersonId: input.targetPersonId }),
      ...(input.senderId === undefined ? {} : { senderId: input.senderId }),
      queuedAt: this.now().toISOString(),
    });

    let result: CommunicationSendResult;

    try {
      result = await this.sendService.send(input.message, { providerId });
    } catch (sendError) {
      // An unexpected transport/programming failure must not leave the record
      // permanently QUEUED. The persisted reason is a stable constant: raw
      // exception text can carry a credential-bearing URL or request body, so
      // it is never written to history. The original error is preserved as a
      // non-persisted diagnostic instead.
      try {
        await this.persistence.applyOutcome({
          communicationId,
          outcome: {
            status: 'FAILED',
            failureReason: 'Unexpected send failure.',
            providerMessageId: null,
          },
        });
      } catch (persistenceError) {
        // Both failures are surfaced together so neither disappears, and the
        // provider is never called again.
        throw new CommunicationUnexpectedSendFailureError({
          communicationId,
          sendCause: sendError,
          persistenceCause: persistenceError,
        });
      }

      throw sendError;
    }

    try {
      await this.persistence.applyOutcome({
        communicationId,
        outcome: buildOutcome({ result, now: this.now().toISOString() }),
      });
    } catch (error) {
      // The provider already returned a result. Never send again
      // automatically; surface the persistence failure explicitly instead.
      throw new CommunicationOutcomePersistenceError({
        communicationId,
        sendResult: result,
        cause: error,
      });
    }

    return { communicationId, result };
  }
}
