import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';

// Normalized input a provider needs in order to send one message. It carries
// no persistence or framework concerns: the provider never sees the
// `communication` record, its id, or its status field.
export type OutboundCommunication = {
  channel: CommunicationChannel;
  /** Provider-native destination, e.g. a phone number for SMS. */
  recipient: string;
  body: string;
  /** Only meaningful when the channel reports `supportsSubject`. */
  subject?: string;
};
