import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';

// Raised when a channel has no registered provider. A missing provider is an
// explicit failure rather than a silent no-op, so a channel can never look
// supported while nothing can actually send it.
export class CommunicationProviderNotFoundError extends Error {
  readonly channel: CommunicationChannel;

  constructor(channel: CommunicationChannel) {
    super(`No communication provider registered for channel "${channel}".`);
    this.name = 'CommunicationProviderNotFoundError';
    this.channel = channel;
  }
}
