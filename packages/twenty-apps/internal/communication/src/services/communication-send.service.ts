import {
  resolveConfiguredProviderId,
} from 'src/config/default-provider-selection';
import { type CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

export type SendCommunicationOptions = {
  /** Explicit provider; defaults to the configured provider when omitted. */
  providerId?: CommunicationProviderId;
};

// The single shared entry point for outbound communication. UI and Workflow
// are expected to call this same service later, so it deliberately knows
// nothing about either of them.
//
// Provider selection is delegated entirely to the registry, and the default
// provider comes from configuration. There is no `if (channel === 'SMS')` and
// no `switch (provider)` here: adding a provider or a channel never touches
// this file. It also never sees a provider URL, an auth format, or a
// provider-specific request/response shape.
//
// It does not persist `communication` records — that is a separate integration
// concern (status/timestamps/providerMessageId) owned by a later wave.
export class CommunicationSendService {
  constructor(
    private readonly providerRegistry: CommunicationProviderRegistry,
  ) {}

  async send(
    message: OutboundCommunication,
    options: SendCommunicationOptions = {},
  ): Promise<CommunicationSendResult> {
    const providerId =
      options.providerId ?? this.getConfiguredProviderId();

    const provider = this.providerRegistry.resolve(providerId, message.channel);

    return provider.send(message);
  }

  private getConfiguredProviderId(): CommunicationProviderId {
    const selection = resolveConfiguredProviderId();

    if (!selection.success) {
      throw new Error(selection.error);
    }

    return selection.providerId;
  }
}
