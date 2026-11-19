import { describe, expect, it } from 'vitest';

import { BaleCommunicationProvider } from 'src/providers/bale/bale.provider';
import {
  type CommunicationHttpClient,
  type CommunicationHttpRequest,
} from 'src/providers/http/communication-http-client';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const BOT_TOKEN = 'test-bale-token-must-never-leak';
const API_BASE = 'https://bale.test';

const MESSAGE: OutboundCommunication = {
  channel: 'BALE',
  recipient: '183266491',
  body: 'پیش‌فاکتور نمونه',
};

type StubResponse = {
  status?: number;
  ok?: boolean;
  rawBody: string;
};

const buildProvider = (
  respond: (request: CommunicationHttpRequest) => StubResponse,
) => {
  const requests: CommunicationHttpRequest[] = [];

  const httpClient: CommunicationHttpClient = async (request) => {
    requests.push(request);

    const { status = 200, ok = status >= 200 && status < 300, rawBody } =
      respond(request);

    return { status, ok, text: async () => rawBody };
  };

  const provider = new BaleCommunicationProvider({
    httpClient,
    apiBase: API_BASE,
    getConfig: () => ({ botToken: BOT_TOKEN }),
  });

  return { provider, requests };
};

describe('BaleCommunicationProvider', () => {
  it('identifies as bale on BALE and declares capabilities', () => {
    const { provider } = buildProvider(() => ({ rawBody: '{}' }));

    expect(provider.id).toBe('bale');
    expect(provider.channel).toBe('BALE');
    expect(provider.capabilities()).toEqual({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    });
  });

  it('POSTs sendMessage with chat_id and text per docs.bale.ai', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: JSON.stringify({
        ok: true,
        result: { message_id: 522946226 },
      }),
    }));

    await provider.send(MESSAGE);

    expect(requests).toHaveLength(1);
    const [request] = requests;

    expect(request.method).toBe('POST');
    expect(request.url).toBe(`${API_BASE}/bot${BOT_TOKEN}/sendMessage`);
    expect(JSON.parse(request.body ?? '{}')).toEqual({
      chat_id: '183266491',
      text: 'پیش‌فاکتور نمونه',
    });
  });

  it('does not put the bot token in headers or JSON body', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: JSON.stringify({ ok: true, result: { message_id: 1 } }),
    }));

    await provider.send(MESSAGE);

    const [request] = requests;
    expect(JSON.stringify(request.headers)).not.toContain(BOT_TOKEN);
    expect(request.body ?? '').not.toContain(BOT_TOKEN);
  });

  it('maps ok:true to SENT with provider message id', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        ok: true,
        result: { message_id: 987654321 },
      }),
    }));

    await expect(provider.send(MESSAGE)).resolves.toEqual({
      status: 'SENT',
      providerMessageId: '987654321',
    });
  });

  it('maps ok:false to FAILED with description', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found',
      }),
    }));

    await expect(provider.send(MESSAGE)).resolves.toEqual({
      status: 'FAILED',
      failureReason: 'Bad Request: chat not found',
      providerCode: 400,
    });
  });

  it('maps transport failure without leaking the token URL', async () => {
    const provider = new BaleCommunicationProvider({
      apiBase: API_BASE,
      getConfig: () => ({ botToken: BOT_TOKEN }),
      httpClient: async () => {
        throw new Error(`connect failed for /bot${BOT_TOKEN}/sendMessage`);
      },
    });

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({
      status: 'FAILED',
      failureReason: 'Bale request failed.',
    });
    expect(JSON.stringify(result)).not.toContain(BOT_TOKEN);
  });
});
