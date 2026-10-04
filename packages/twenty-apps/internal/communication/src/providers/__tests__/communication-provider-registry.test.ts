import { describe, expect, it } from 'vitest';

import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { CommunicationProviderChannelMismatchError } from 'src/providers/errors/communication-provider-channel-mismatch.error';
import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';

const CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: false,
};

// A stub provider, used only to exercise the boundary. It is never registered
// in application code and performs no I/O.
const buildProvider = ({
  id,
  channel = 'SMS',
}: {
  id: CommunicationProviderId;
  channel?: CommunicationChannel;
}): CommunicationProvider => ({
  id,
  channel,
  capabilities: () => CAPABILITIES,
  send: async (): Promise<CommunicationSendResult> => ({
    status: 'SENT',
    providerMessageId: 'stub-1',
  }),
});

describe('CommunicationProviderRegistry', () => {
  it('resolves the provider registered for a provider id', () => {
    const registry = new CommunicationProviderRegistry();
    const provider = buildProvider({ id: 'kavenegar' });

    registry.register(provider);

    expect(registry.getProvider('kavenegar')).toBe(provider);
    expect(registry.hasProvider('kavenegar')).toBe(true);
  });

  it('supports two providers for the same channel simultaneously', () => {
    const registry = new CommunicationProviderRegistry();
    const kavenegar = buildProvider({ id: 'kavenegar' });
    const razpayamak = buildProvider({ id: 'razpayamak' });

    registry.register(kavenegar);
    registry.register(razpayamak);

    expect(registry.listProviderIds()).toEqual(['kavenegar', 'razpayamak']);
    expect(registry.getProvider('kavenegar')).toBe(kavenegar);
    expect(registry.getProvider('razpayamak')).toBe(razpayamak);
    // Both declare SMS; the registry keys on identity, not on channel.
    expect(registry.getProvider('kavenegar').channel).toBe('SMS');
    expect(registry.getProvider('razpayamak').channel).toBe('SMS');
  });

  it('fails explicitly when no provider is registered for the id', () => {
    const registry = new CommunicationProviderRegistry();

    expect(registry.hasProvider('razpayamak')).toBe(false);
    expect(() => registry.getProvider('razpayamak')).toThrow(
      CommunicationProviderNotFoundError,
    );
    expect(() => registry.getProvider('razpayamak')).toThrow(
      'No communication provider registered with id "razpayamak".',
    );
  });

  it('rejects a duplicate provider id instead of overriding it', () => {
    const registry = new CommunicationProviderRegistry();
    const first = buildProvider({ id: 'kavenegar' });
    const second = buildProvider({ id: 'kavenegar' });

    registry.register(first);

    expect(() => registry.register(second)).toThrow(
      'A communication provider is already registered with id "kavenegar".',
    );
    // The first registration stays in effect — duplicates never silently win.
    expect(registry.getProvider('kavenegar')).toBe(first);
  });

  it('enforces channel compatibility when resolving', () => {
    const registry = new CommunicationProviderRegistry();
    const provider = buildProvider({ id: 'kavenegar', channel: 'SMS' });

    registry.register(provider);

    expect(registry.resolve('kavenegar', 'SMS')).toBe(provider);
    // A channel the provider does not declare is a hard failure, not a no-op.
    expect(() => registry.resolve('kavenegar', 'TELEGRAM' as never)).toThrow(
      CommunicationProviderChannelMismatchError,
    );
  });

  it('does not share state between registry instances', () => {
    const firstRegistry = new CommunicationProviderRegistry();
    const secondRegistry = new CommunicationProviderRegistry();

    firstRegistry.register(buildProvider({ id: 'kavenegar' }));

    expect(firstRegistry.hasProvider('kavenegar')).toBe(true);
    expect(secondRegistry.hasProvider('kavenegar')).toBe(false);
  });
});
