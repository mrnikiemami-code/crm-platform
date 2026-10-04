import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

// Application-level input for a durable outbound send. It carries the
// provider-facing message plus optional CRM context, and deliberately keeps
// persistence concerns out of `OutboundCommunication`.
export type SendCommunicationInput = {
  /** The normalized message handed to the provider. */
  message: OutboundCommunication;
  /** Explicit provider; defaults to the configured provider when omitted. */
  providerId?: CommunicationProviderId;
  /** Optional Person to link the communication to. */
  targetPersonId?: string;
  /** Optional workspace member recorded as the sender. */
  senderId?: string;
  /** Optional subject; only meaningful for channels that support one. */
  subject?: string;
};
