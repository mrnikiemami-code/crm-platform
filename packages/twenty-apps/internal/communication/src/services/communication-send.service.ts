import { type CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

// The single shared entry point for outbound communication. UI and Workflow
// are expected to call this same service later, so it deliberately knows
// nothing about either of them.
//
// Provider selection is delegated entirely to the registry: there is no
// `if (channel === 'SMS')` here, and adding a channel never touches this file.
//
// It does not persist `communication` records — that is a separate integration
// concern (status/timestamps/providerMessageId) owned by a later wave.
export class CommunicationSendService {
  constructor(
    private readonly providerRegistry: CommunicationProviderRegistry,
  ) {}

  async send(
    message: OutboundCommunication,
  ): Promise<CommunicationSendResult> {
    const provider = this.providerRegistry.getProvider(message.channel);

    return provider.send(message);
  }
}
