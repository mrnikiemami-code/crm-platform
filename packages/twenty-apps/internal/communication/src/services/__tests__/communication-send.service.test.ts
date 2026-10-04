import { describe, expect, it } from 'vitest';

import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';
import { CommunicationSendService } from 'src/services/communication-send.service';

const MESSAGE: OutboundCommunication = {
  channel: 'SMS',
  recipient: '09120000000',
  body: 'hello',
};

const buildStubProvider = (
  result: CommunicationSendResult,
): { provider: CommunicationProvider; sent: OutboundCommunication[] } => {
  const sent: OutboundCommunication[] = [];

  return {
    sent,
    provider: {
      channel: 'SMS',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send: async (message) => {
        sent.push(message);

        return result;
      },
    },
  };
};

describe('CommunicationSendService', () => {
  it('resolves the provider for the message channel and delegates to it', async () => {
    const registry = new CommunicationProviderRegistry();
    const { provider, sent } = buildStubProvider({
      status: 'SENT',
      providerMessageId: '1',
    });

    registry.register(provider);

    const service = new CommunicationSendService(registry);

    expect(await service.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: '1',
    });
    expect(sent).toEqual([MESSAGE]);
  });

  it('returns the provider result unchanged, including failures', async () => {
    const registry = new CommunicationProviderRegistry();
    const { provider } = buildStubProvider({
      status: 'FAILED',
      failureReason: 'provider down',
    });

    registry.register(provider);

    const service = new CommunicationSendService(registry);

    expect(await service.send(MESSAGE)).toEqual({
      status: 'FAILED',
      failureReason: 'provider down',
    });
  });

  it('fails explicitly when no provider is registered for the channel', async () => {
    const service = new CommunicationSendService(
      new CommunicationProviderRegistry(),
    );

    await expect(service.send(MESSAGE)).rejects.toThrow(
      CommunicationProviderNotFoundError,
    );
  });
});
