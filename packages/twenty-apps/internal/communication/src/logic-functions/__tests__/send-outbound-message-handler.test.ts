import { describe, expect, it, vi } from 'vitest';

import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import {
  isValidBaleChatId,
  sendOutboundMessageHandler,
} from 'src/logic-functions/handlers/send-outbound-message-handler';

describe('isValidBaleChatId', () => {
  it('accepts numeric chat ids only', () => {
    expect(isValidBaleChatId('183266491')).toBe(true);
    expect(isValidBaleChatId('-100123')).toBe(true);
    expect(isValidBaleChatId('@channel')).toBe(false);
    expect(isValidBaleChatId('')).toBe(false);
    expect(isValidBaleChatId('abc')).toBe(false);
  });
});

describe('sendOutboundMessageHandler', () => {
  it('refuses non-numeric Bale recipients before calling the provider', async () => {
    const send = vi.fn();
    const registry = new CommunicationProviderRegistry();
    registry.register({
      id: 'bale',
      channel: 'BALE',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send,
    } as CommunicationProvider);

    const result = await sendOutboundMessageHandler(
      {
        channel: 'BALE',
        providerId: 'bale',
        recipient: 'not-a-chat',
        body: 'hello',
      },
      {
        registry,
        client: { mutation: vi.fn() } as never,
      },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failureCode).toBe('INVALID_INPUT');
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('persists SENT through Send/Persist when the provider accepts', async () => {
    const send = vi.fn().mockResolvedValue({
      status: 'SENT',
      providerMessageId: 'msg-9',
    });
    const registry = new CommunicationProviderRegistry();
    registry.register({
      id: 'bale',
      channel: 'BALE',
      capabilities: () => ({
        supportsSubject: false,
        supportsDeliveryReceipt: false,
      }),
      send,
    } as CommunicationProvider);

    const mutation = vi
      .fn()
      .mockResolvedValueOnce({ createCommunication: { id: 'comm-1' } })
      .mockResolvedValueOnce({ updateCommunication: { id: 'comm-1' } });

    const result = await sendOutboundMessageHandler(
      {
        channel: 'BALE',
        providerId: 'bale',
        recipient: '183266491',
        body: 'پیش‌فاکتور',
        targetPersonId: 'person-1',
        sourceRecordId: 'quotation-1',
      },
      {
        registry,
        client: { mutation } as never,
      },
    );

    expect(result).toEqual({
      success: true,
      communicationId: 'comm-1',
      providerId: 'bale',
      sendStatus: 'SENT',
      providerMessageId: 'msg-9',
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
