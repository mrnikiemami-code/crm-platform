import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

// Raised when a provider is asked to send on a channel it does not declare.
// Compatibility is enforced by the registry rather than by a caller-side
// `if`, so a mismatch fails loudly instead of being silently ignored.
export class CommunicationProviderChannelMismatchError extends Error {
  readonly providerId: CommunicationProviderId;
  readonly requestedChannel: CommunicationChannel;
  readonly supportedChannel: CommunicationChannel;

  constructor({
    providerId,
    requestedChannel,
    supportedChannel,
  }: {
    providerId: CommunicationProviderId;
    requestedChannel: CommunicationChannel;
    supportedChannel: CommunicationChannel;
  }) {
    super(
      `Communication provider "${providerId}" supports channel "${supportedChannel}" and cannot send on channel "${requestedChannel}".`,
    );
    this.name = 'CommunicationProviderChannelMismatchError';
    this.providerId = providerId;
    this.requestedChannel = requestedChannel;
    this.supportedChannel = supportedChannel;
  }
}
