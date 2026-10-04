import { describe, expect, it } from 'vitest';

import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: true,
};

// A stub provider, used only to exercise the boundary. It is never registered
// in application code and performs no I/O.
const buildProvider = (
  channel: CommunicationChannel,
  overrides: Partial<CommunicationProvider> = {},
): CommunicationProvider => ({
  channel,
  capabilities: () => CAPABILITIES,
  send: async (): Promise<CommunicationSendResult> => ({
    status: 'SENT',
    providerMessageId: 'stub-1',
  }),
  ...overrides,
});

describe('CommunicationProviderRegistry', () => {
  it('resolves the provider registered for a channel', () => {
    const registry = new CommunicationProviderRegistry();
    const provider = buildProvider('SMS');

    registry.register(provider);

    expect(registry.getProvider('SMS')).toBe(provider);
    expect(registry.hasProvider('SMS')).toBe(true);
  });

  it('fails explicitly when no provider is registered for the channel', () => {
    const registry = new CommunicationProviderRegistry();

    expect(registry.hasProvider('SMS')).toBe(false);
    expect(() => registry.getProvider('SMS')).toThrow(
      CommunicationProviderNotFoundError,
    );
    expect(() => registry.getProvider('SMS')).toThrow(
      'No communication provider registered for channel "SMS".',
    );
  });

  it('rejects a duplicate registration instead of overriding it', () => {
    const registry = new CommunicationProviderRegistry();
    const first = buildProvider('SMS');
    const second = buildProvider('SMS');

    registry.register(first);

    expect(() => registry.register(second)).toThrow(
      'A communication provider is already registered for channel "SMS".',
    );
    // The first registration stays in effect — duplicates never silently win.
    expect(registry.getProvider('SMS')).toBe(first);
  });

  it('returns the provider as-is, without channel-specific branching', () => {
    const registry = new CommunicationProviderRegistry();
    const provider = buildProvider('SMS', {
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
    });

    registry.register(provider);

    const resolved = registry.getProvider('SMS');
    const message: OutboundCommunication = {
      channel: 'SMS',
      recipient: '+10000000000',
      body: 'hello',
    };

    // The caller talks to the contract only: it never inspects the channel.
    expect(resolved.capabilities()).toEqual({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    });
    expect(typeof resolved.send).toBe('function');
    expect(message.channel).toBe('SMS');
  });

  it('does not share state between registry instances', () => {
    const firstRegistry = new CommunicationProviderRegistry();
    const secondRegistry = new CommunicationProviderRegistry();

    firstRegistry.register(buildProvider('SMS'));

    expect(firstRegistry.hasProvider('SMS')).toBe(true);
    expect(secondRegistry.hasProvider('SMS')).toBe(false);
  });
});
