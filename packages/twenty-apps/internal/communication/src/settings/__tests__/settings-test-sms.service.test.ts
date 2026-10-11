import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { sendSettingsTestSms } from 'src/settings/settings-test-sms.service';

const SAVED_ENV = { ...process.env };

// The settings test-send resolves the configured provider, so the selection
// variable must be set for the happy path.
beforeEach(() => {
  process.env.COMMUNICATION_PROVIDER = 'razpayamak';
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

const buildRegistry = (result: CommunicationSendResult) => {
  const sentMessages: { recipient: string; body: string }[] = [];

  const provider: CommunicationProvider = {
    id: 'razpayamak',
    channel: 'SMS',
    capabilities: () => ({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    }),
    send: async (message) => {
      sentMessages.push({ recipient: message.recipient, body: message.body });
      return result;
    },
  };

  const registry = new CommunicationProviderRegistry();
  registry.register(provider);

  return { registry, sentMessages };
};

describe('sendSettingsTestSms', () => {
  it('normalizes the recipient and sends exactly once on success', async () => {
    const { registry, sentMessages } = buildRegistry({
      status: 'SENT',
      providerMessageId: '555',
    });

    const response = await sendSettingsTestSms(
      { recipient: '+98 912 000 0000', body: 'سلام' },
      { registry, providerId: 'razpayamak' },
    );

    expect(response).toEqual({
      success: true,
      status: 'SENT',
      providerMessageId: '555',
      isOutcomeKnown: true,
    });
    expect(sentMessages).toEqual([
      { recipient: '989120000000', body: 'سلام' },
    ]);
  });

  it('rejects an invalid recipient without any provider call', async () => {
    const { registry, sentMessages } = buildRegistry({
      status: 'SENT',
      providerMessageId: null,
    });

    const response = await sendSettingsTestSms(
      { recipient: 'abc', body: 'سلام' },
      { registry },
    );

    expect(response).toMatchObject({
      success: false,
      failureCode: 'INVALID_RECIPIENT',
    });
    expect(sentMessages).toHaveLength(0);
  });

  it('rejects an empty body without any provider call', async () => {
    const { registry, sentMessages } = buildRegistry({
      status: 'SENT',
      providerMessageId: null,
    });

    const response = await sendSettingsTestSms(
      { recipient: '09120000000', body: '   ' },
      { registry },
    );

    expect(response).toMatchObject({
      success: false,
      failureCode: 'EMPTY_MESSAGE',
    });
    expect(sentMessages).toHaveLength(0);
  });

  it('maps a definite provider rejection to a sanitized failure', async () => {
    const { registry } = buildRegistry({
      status: 'FAILED',
      failureReason: 'RazPayamak rejected the request with code 0.',
      failureCode: 'INVALID_CREDENTIALS',
      providerCode: 0,
      providerDetail: 'Username or password is not correct',
    });

    const response = await sendSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { registry },
    );

    expect(response).toMatchObject({
      success: false,
      failureCode: 'PROVIDER_FAILED',
      providerFailureCode: 'INVALID_CREDENTIALS',
      providerCode: 0,
      isOutcomeKnown: true,
    });
  });

  it('reports an unknown outcome truthfully and never claims success', async () => {
    const { registry } = buildRegistry({
      status: 'UNKNOWN',
      failureReason: 'The RazPayamak request could not be completed.',
    });

    const response = await sendSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { registry },
    );

    expect(response).toMatchObject({
      success: false,
      failureCode: 'OUTCOME_UNKNOWN',
      isOutcomeKnown: false,
    });
    expect(response.status).toBeUndefined();
  });

  it('never leaks credentials through the response', async () => {
    const { registry } = buildRegistry({
      status: 'FAILED',
      failureReason: 'RazPayamak request failed.',
    });

    const response = await sendSettingsTestSms(
      { recipient: '09120000000', body: 'سلام' },
      { registry },
    );

    expect(JSON.stringify(response)).not.toContain('password');
  });
});
