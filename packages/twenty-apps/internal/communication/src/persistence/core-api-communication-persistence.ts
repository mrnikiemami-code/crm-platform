import { randomUUID } from 'node:crypto';

import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  type CommunicationPersistence,
  type CommunicationRecordOutcome,
  type QueuedCommunicationRecord,
} from 'src/persistence/communication-persistence.port';

type CommunicationOutcomeFields = {
  status: string;
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string | null;
  providerMessageId?: string | null;
};

// Maps the outcome union onto record fields. Only fields meaningful for the
// outcome are sent, so a failure can never write a `sentAt`/`deliveredAt`.
export const buildOutcomeFields = (
  outcome: CommunicationRecordOutcome,
): CommunicationOutcomeFields => {
  switch (outcome.status) {
    case 'SENT':
      return {
        status: 'SENT',
        sentAt: outcome.sentAt,
        providerMessageId: outcome.providerMessageId,
        failureReason: null,
      };
    case 'DELIVERED':
      return {
        status: 'DELIVERED',
        sentAt: outcome.sentAt,
        deliveredAt: outcome.deliveredAt,
        providerMessageId: outcome.providerMessageId,
        failureReason: null,
      };
    case 'FAILED':
      return {
        status: 'FAILED',
        failureReason: outcome.failureReason,
        providerMessageId: outcome.providerMessageId,
      };
  }
};

// Durable storage for `communication` records, backed by the app runtime's
// own Core API client. This is the repository-supported way app code persists
// its workspace objects: no core repository import, no raw SQL, and no
// parallel database mechanism.
//
// Secrets are never written here: the record only carries the send-time
// provider id, recipient, body and outcome.
export class CoreApiCommunicationPersistence
  implements CommunicationPersistence
{
  constructor(
    private readonly client: CoreApiClient,
    /** Injected id factory so tests can be deterministic. */
    private readonly generateId: () => string = () => randomUUID(),
  ) {}

  async createQueued(record: QueuedCommunicationRecord): Promise<string> {
    const id = this.generateId();

    const result = await this.client.mutation({
      createCommunication: {
        __args: {
          data: {
            id,
            channel: record.channel,
            providerId: record.providerId,
            recipient: record.recipient,
            body: record.body,
            status: 'QUEUED',
            direction: 'OUTBOUND',
            queuedAt: record.queuedAt,
            ...(record.subject === undefined
              ? {}
              : { subject: record.subject }),
            ...(record.targetPersonId === undefined
              ? {}
              : { targetPersonId: record.targetPersonId }),
            ...(record.senderId === undefined
              ? {}
              : { senderId: record.senderId }),
          },
        },
        id: true,
      },
    });

    const createdId = result.createCommunication?.id;

    if (createdId === undefined || createdId === null) {
      throw new Error(
        'createCommunication mutation did not return a communication id',
      );
    }

    return createdId;
  }

  async applyOutcome({
    communicationId,
    outcome,
  }: {
    communicationId: string;
    outcome: CommunicationRecordOutcome;
  }): Promise<void> {
    await this.client.mutation({
      updateCommunication: {
        __args: {
          id: communicationId,
          data: buildOutcomeFields(outcome),
        },
        id: true,
      },
    });
  }
}
