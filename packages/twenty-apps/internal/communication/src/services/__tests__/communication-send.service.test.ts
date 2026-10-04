import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { COMMUNICATION_PROVIDER_ENV_VAR } from 'src/config/default-provider-selection';
import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { CommunicationProviderChannelMismatchError } from 'src/providers/errors/communication-provider-channel-mismatch.error';
import { CommunicationProviderNotFoundError } from 'src/providers/errors/communication-provider-not-found.error';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';
import { CommunicationSendService } from 'src/services/communication-send.service';

const SAVED_ENV = { ...process.env };

const MESSAGE: OutboundCommunication = {
  channel: 'SMS',
  recipient: '09120000000',
  body: 'hello',
};

const buildStubProvider = (
  id: CommunicationProviderId,
  result: CommunicationSendResult,
): { provider: CommunicationProvider; sent: OutboundCommunication[] } => {
  const sent: OutboundCommunication[] = [];

  return {
    sent,
    provider: {
      id,
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

const buildRegistryWithBothProviders = () => {
  const registry = new CommunicationProviderRegistry();
  const kavenegar = buildStubProvider('kavenegar', {
    status: 'SENT',
    providerMessageId: 'kavenegar-1',
  });
  const razpayamak = buildStubProvider('razpayamak', {
    status: 'SENT',
    providerMessageId: 'razpayamak-1',
  });

  registry.register(kavenegar.provider);
  registry.register(razpayamak.provider);

  return { registry, kavenegar, razpayamak };
};

describe('CommunicationSendService', () => {
  beforeEach(() => {
    delete process.env[COMMUNICATION_PROVIDER_ENV_VAR];
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('delegates to the explicitly requested provider', async () => {
    const { registry, razpayamak, kavenegar } =
      buildRegistryWithBothProviders();
    const service = new CommunicationSendService(registry);

    expect(await service.send(MESSAGE, { providerId: 'razpayamak' })).toEqual({
      status: 'SENT',
      providerMessageId: 'razpayamak-1',
    });
    expect(razpayamak.sent).toEqual([MESSAGE]);
    expect(kavenegar.sent).toEqual([]);
  });

  it('delegates to the configured default provider without branching', async () => {
    process.env[COMMUNICATION_PROVIDER_ENV_VAR] = 'kavenegar';

    const { registry, kavenegar, razpayamak } =
      buildRegistryWithBothProviders();
    const service = new CommunicationSendService(registry);

    expect(await service.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: 'kavenegar-1',
    });
    expect(kavenegar.sent).toEqual([MESSAGE]);
    expect(razpayamak.sent).toEqual([]);
  });

  it('returns the provider result unchanged, including failures', async () => {
    const registry = new CommunicationProviderRegistry();

    registry.register(
      buildStubProvider('razpayamak', {
        status: 'FAILED',
        failureReason: 'provider down',
      }).provider,
    );

    const service = new CommunicationSendService(registry);

    expect(await service.send(MESSAGE, { providerId: 'razpayamak' })).toEqual({
      status: 'FAILED',
      failureReason: 'provider down',
    });
  });

  it('fails explicitly when the requested provider is not registered', async () => {
    const registry = new CommunicationProviderRegistry();

    registry.register(buildStubProvider('kavenegar', {
      status: 'SENT',
      providerMessageId: 'kavenegar-1',
    }).provider);

    const service = new CommunicationSendService(registry);

    await expect(
      service.send(MESSAGE, { providerId: 'razpayamak' }),
    ).rejects.toThrow(CommunicationProviderNotFoundError);
  });

  it('fails explicitly on a provider/channel mismatch', async () => {
    const registry = new CommunicationProviderRegistry();

    registry.register(buildStubProvider('kavenegar', {
      status: 'SENT',
      providerMessageId: 'kavenegar-1',
    }).provider);

    const service = new CommunicationSendService(registry);

    await expect(
      service.send({ ...MESSAGE, channel: 'TELEGRAM' as never }, {
        providerId: 'kavenegar',
      }),
    ).rejects.toThrow(CommunicationProviderChannelMismatchError);
  });

  it('fails explicitly when no default provider is configured', async () => {
    const { registry } = buildRegistryWithBothProviders();
    const service = new CommunicationSendService(registry);

    await expect(service.send(MESSAGE)).rejects.toThrow(
      `Set the ${COMMUNICATION_PROVIDER_ENV_VAR} application variable`,
    );
  });

  it('fails explicitly when the configured default provider is unknown', async () => {
    process.env[COMMUNICATION_PROVIDER_ENV_VAR] = 'unknown-vendor';

    const { registry } = buildRegistryWithBothProviders();
    const service = new CommunicationSendService(registry);

    await expect(service.send(MESSAGE)).rejects.toThrow(
      'Unknown communication provider "unknown-vendor"',
    );
  });
});
