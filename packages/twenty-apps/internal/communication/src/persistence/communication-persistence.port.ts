import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

// The subset of `communication` record state the orchestration owns. It is a
// plain data shape so the persistence adapter stays swappable and testable
// without a live workspace.
export type QueuedCommunicationRecord = {
  channel: CommunicationChannel;
  providerId: CommunicationProviderId;
  recipient: string;
  body: string;
  subject?: string;
  targetPersonId?: string;
  senderId?: string;
  queuedAt: string;
};

// The final outcome to persist. Only the fields that are meaningful for the
// outcome are present, so a failure can never accidentally carry a `sentAt`.
export type CommunicationRecordOutcome =
  | {
      status: 'SENT';
      sentAt: string;
      providerMessageId: string | null;
    }
  | {
      status: 'DELIVERED';
      sentAt: string;
      deliveredAt: string;
      providerMessageId: string | null;
    }
  | {
      status: 'FAILED';
      failureReason: string;
      providerMessageId: string | null;
    };

// Port for durable storage of a communication attempt. The application
// orchestration depends on this contract rather than on any transport, so it
// never imports a database client or a framework concern.
export type CommunicationPersistence = {
  /** Creates the initial QUEUED record and returns its id. */
  createQueued(record: QueuedCommunicationRecord): Promise<string>;
  /** Writes the final outcome onto an existing record. */
  applyOutcome({
    communicationId,
    outcome,
  }: {
    communicationId: string;
    outcome: CommunicationRecordOutcome;
  }): Promise<void>;
};
