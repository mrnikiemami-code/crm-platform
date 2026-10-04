import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';

// App-local selection seam. It is intentionally instance-based rather than a
// module-level singleton: the registry is created where it is used, so there
// is no global mutable state and no dependency-injection/core wiring.
//
// Selection is by the provider's own `channel`, never by branching on the
// channel at the call site.
export class CommunicationProviderRegistry {
  private readonly providersByChannel = new Map<
    CommunicationChannel,
    CommunicationProvider
  >();

  /**
   * Registers a provider for its channel.
   *
   * Duplicate registration is an explicit error rather than a silent override:
   * two providers claiming one channel is a wiring mistake, and the failure
   * should surface at registration time, not at send time.
   */
  register(provider: CommunicationProvider): void {
    if (this.providersByChannel.has(provider.channel)) {
      throw new Error(
        `A communication provider is already registered for channel "${provider.channel}".`,
      );
    }

    this.providersByChannel.set(provider.channel, provider);
  }

  /** Resolves the provider for a channel, or throws if none is registered. */
  getProvider(channel: CommunicationChannel): CommunicationProvider {
    const provider = this.providersByChannel.get(channel);

    if (provider === undefined) {
      throw new CommunicationProviderNotFoundError(channel);
    }

    return provider;
  }

  /** Whether a channel currently has a provider. */
  hasProvider(channel: CommunicationChannel): boolean {
    return this.providersByChannel.has(channel);
  }
}
