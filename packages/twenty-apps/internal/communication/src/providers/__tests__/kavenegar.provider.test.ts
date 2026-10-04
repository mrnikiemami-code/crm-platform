import { describe, expect, it } from 'vitest';

import { KavenegarCommunicationProvider } from 'src/providers/kavenegar/kavenegar.provider';
import {
  type CommunicationHttpClient,
  type CommunicationHttpRequest,
} from 'src/providers/http/communication-http-client';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const API_KEY = 'test-api-key-should-never-leak';
const SENDER = '10004346';
const ENDPOINT = 'https://api.kavenegar.test/v1';

const MESSAGE: OutboundCommunication = {
  channel: 'SMS',
  recipient: '09120000000',
  body: 'سلام',
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

  const provider = new KavenegarCommunicationProvider({
    httpClient,
    getConfig: () => ({ endpoint: ENDPOINT, apiKey: API_KEY, sender: SENDER }),
  });

  return { provider, requests };
};

describe('KavenegarCommunicationProvider', () => {
  it('identifies as kavenegar on SMS and declares its capabilities', () => {
    const { provider } = buildProvider(() => ({ rawBody: '{}' }));

    expect(provider.id).toBe('kavenegar');
    expect(provider.channel).toBe('SMS');
    // Delivery receipt is not implemented through this driver yet.
    expect(provider.capabilities()).toEqual({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    });
  });

  it('maps recipient, body and configured sender onto the Kavenegar request', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: JSON.stringify({ return: { status: 200 }, entries: [] }),
    }));

    await provider.send(MESSAGE);

    expect(requests).toHaveLength(1);

    const [request] = requests;
    const url = new URL(request.url);

    expect(request.method).toBe('GET');
    expect(url.pathname).toBe(`/v1/${API_KEY}/sms/send.json`);
    expect(url.searchParams.get('receptor')).toBe('09120000000');
    expect(url.searchParams.get('message')).toBe('سلام');
    expect(url.searchParams.get('sender')).toBe(SENDER);
  });

  it('uses the API key without exposing it in headers or body', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: JSON.stringify({ return: { status: 200 }, entries: [] }),
    }));

    await provider.send(MESSAGE);

    const [request] = requests;

    expect(request.body).toBeUndefined();
    expect(JSON.stringify(request.headers)).not.toContain(API_KEY);
  });

  it('maps a successful response to SENT with the provider message id', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        return: { status: 200, message: 'OK' },
        entries: [{ messageid: 987654321, status: 1, statustext: 'queued' }],
      }),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: '987654321',
    });
  });

  it('reports SENT with a null id when the provider omits entries', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({ return: { status: 200 } }),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: null,
    });
  });

  it('normalizes a provider rejection into FAILED with the provider message', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        return: { status: 424, message: 'Invalid receptor' },
      }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result.status).toBe('FAILED');
    expect(result).toHaveProperty('failureReason', 'Invalid receptor');
  });

  it('normalizes a non-2xx HTTP response into FAILED', async () => {
    const { provider } = buildProvider(() => ({
      status: 401,
      rawBody: JSON.stringify({
        return: { status: 401, message: 'Unauthorized' },
      }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result).toHaveProperty('failureReason', 'Unauthorized');
  });

  it('normalizes a transport failure into a stable FAILED reason', async () => {
    const provider = new KavenegarCommunicationProvider({
      httpClient: async () => {
        throw new Error('socket hang up');
      },
      getConfig: () => ({ endpoint: ENDPOINT, apiKey: API_KEY, sender: SENDER }),
    });

    const result = await provider.send(MESSAGE);

    expect(result).toEqual({
      status: 'FAILED',
      failureReason: 'Kavenegar request failed.',
    });
  });

  it('does not expose the API key when a transport error embeds the request URL', async () => {
    const provider = new KavenegarCommunicationProvider({
      httpClient: async () => {
        // A real transport error can echo the credential-bearing URL.
        throw new Error(
          `request to https://api.kavenegar.test/v1/${API_KEY}/sms/send.json?receptor=09120000000 failed`,
        );
      },
      getConfig: () => ({ endpoint: ENDPOINT, apiKey: API_KEY, sender: SENDER }),
    });

    const result = await provider.send(MESSAGE);

    expect(result.status).toBe('FAILED');
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain('sms/send.json');
  });

  it('never leaks the API key through a failure reason', async () => {
    const { provider } = buildProvider(() => ({
      status: 500,
      rawBody: 'upstream error',
    }));

    const result = await provider.send(MESSAGE);

    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('fails explicitly when the request is made without configuration', async () => {
    const provider = new KavenegarCommunicationProvider({
      httpClient: async () => ({ status: 200, ok: true, text: async () => '{}' }),
      getConfig: () => {
        throw new Error(
          'Kavenegar is not configured. Set the following application variable(s): KAVENEGAR_API_KEY.',
        );
      },
    });

    await expect(provider.send(MESSAGE)).rejects.toThrow(
      'KAVENEGAR_API_KEY',
    );
  });
});
