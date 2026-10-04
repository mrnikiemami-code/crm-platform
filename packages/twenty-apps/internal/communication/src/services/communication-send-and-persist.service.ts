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

// Raised when the provider accepted or rejected the message but the outcome
// could not be recorded. The send already happened, so this must surface
// loudly instead of triggering a second send.
export class CommunicationOutcomePersistenceError extends Error {
  readonly communicationId: string;
  readonly sendResult: CommunicationSendResult;
  /** Underlying persistence failure, kept for diagnostics. */
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
      `Communication ${communicationId} was sent but its outcome could not be persisted.`,
    );
    this.name = 'CommunicationOutcomePersistenceError';
    this.communicationId = communicationId;
    this.sendResult = sendResult;
    this.persistenceCause = cause;
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
      ...(input.subject === undefined ? {} : { subject: input.subject }),
      ...(input.targetPersonId === undefined
        ? {}
        : { targetPersonId: input.targetPersonId }),
      ...(input.senderId === undefined ? {} : { senderId: input.senderId }),
      queuedAt: this.now().toISOString(),
    });

    let result: CommunicationSendResult;

    try {
      result = await this.sendService.send(input.message, { providerId });
    } catch (error) {
      // An unexpected transport/programming failure must not leave the record
      // permanently QUEUED. The reason is normalized and never carries a
      // credential-bearing payload; the original error is still surfaced.
      await this.tryApplyOutcome(communicationId, {
        status: 'FAILED',
        failureReason:
          error instanceof Error
            ? `Unexpected send failure: ${error.message}`
            : 'Unexpected send failure.',
        providerMessageId: null,
      });

      throw error;
    }

    try {
      await this.persistence.applyOutcome({
        communicationId,
        outcome: buildOutcome({ result, now: this.now().toISOString() }),
      });
    } catch (error) {
      // The message is already sent. Never send again automatically; surface
      // the persistence failure explicitly instead.
      throw new CommunicationOutcomePersistenceError({
        communicationId,
        sendResult: result,
        cause: error,
      });
    }

    return { communicationId, result };
  }

  private async tryApplyOutcome(
    communicationId: string,
    outcome: CommunicationRecordOutcome,
  ): Promise<void> {
    try {
      await this.persistence.applyOutcome({ communicationId, outcome });
    } catch {
      // The send itself already failed and is being rethrown; a failing
      // cleanup write must not mask that original error.
    }
  }
}
