import { CommunicationProviderChannelMismatchError } from 'src/providers/errors/communication-provider-channel-mismatch.error';
import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';

// App-local selection seam. It is intentionally instance-based rather than a
// module-level singleton: the registry is created where it is used, so there
// is no global mutable state and no dependency-injection/core wiring.
//
// Keyed by provider id, not by channel, because several providers can serve
// the same channel (`kavenegar` and `razpayamak` both send SMS). Selection is
// therefore always "which implementation", never "which channel", and no
// caller needs a channel-specific branch.
export class CommunicationProviderRegistry {
  private readonly providersById = new Map<
    CommunicationProviderId,
    CommunicationProvider
  >();

  /**
   * Registers a provider under its own id.
   *
   * Duplicate ids are an explicit error rather than a silent override: two
   * implementations claiming one identity is a wiring mistake, and it should
   * surface at registration time, not at send time. Registering different ids
   * for the same channel is expected and allowed.
   */
  register(provider: CommunicationProvider): void {
    if (this.providersById.has(provider.id)) {
      throw new Error(
        `A communication provider is already registered with id "${provider.id}".`,
      );
    }

    this.providersById.set(provider.id, provider);
  }

  /** Resolves a provider by id, or throws if none is registered. */
  getProvider(providerId: CommunicationProviderId): CommunicationProvider {
    const provider = this.providersById.get(providerId);

    if (provider === undefined) {
      throw new CommunicationProviderNotFoundError(providerId);
    }

    return provider;
  }

  /**
   * Resolves a provider by id and asserts it can carry the requested channel.
   * This is how channel compatibility is enforced without caller-side `if`s.
   */
  resolve(
    providerId: CommunicationProviderId,
    channel: CommunicationChannel,
  ): CommunicationProvider {
    const provider = this.getProvider(providerId);

    if (provider.channel !== channel) {
      throw new CommunicationProviderChannelMismatchError({
        providerId,
        requestedChannel: channel,
        supportedChannel: provider.channel,
      });
    }

    return provider;
  }

  /** Whether a provider id is registered. */
  hasProvider(providerId: CommunicationProviderId): boolean {
    return this.providersById.has(providerId);
  }

  /** Registered provider ids, in registration order. */
  listProviderIds(): CommunicationProviderId[] {
    return [...this.providersById.keys()];
  }
}
