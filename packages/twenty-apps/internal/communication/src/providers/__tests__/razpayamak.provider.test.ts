import { describe, expect, it } from 'vitest';

import { RazpayamakCommunicationProvider } from 'src/providers/razpayamak/razpayamak.provider';
import {
  type CommunicationHttpClient,
  type CommunicationHttpRequest,
} from 'src/providers/http/communication-http-client';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const USERNAME = 'panel-user';
const API_KEY = 'razpayamak-api-key-should-never-leak';
const SENDER = '100020003000';
const SEND_URL = 'https://rest.payamak-panel.test/api/SmartSMS/Send';

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

  const provider = new RazpayamakCommunicationProvider({
    sendUrl: SEND_URL,
    httpClient,
    getConfig: () => ({
      username: USERNAME,
      apiKey: API_KEY,
      sender: SENDER,
    }),
  });

  return { provider, requests };
};

const parseBody = (request: CommunicationHttpRequest) =>
  JSON.parse(request.body ?? '{}') as Record<string, unknown>;

describe('RazpayamakCommunicationProvider', () => {
  it('identifies as razpayamak on the SMS channel', () => {
    const { provider } = buildProvider(() => ({ rawBody: '{}' }));

    expect(provider.id).toBe('razpayamak');
    expect(provider.channel).toBe('SMS');
    // Delivery receipt is not implemented through this driver yet.
    expect(provider.capabilities()).toEqual({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    });
  });

  it('posts the documented SmartSMS send payload', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok', Value: '1' }),
    }));

    await provider.send(MESSAGE);

    expect(requests).toHaveLength(1);

    const [request] = requests;

    expect(request.method).toBe('POST');
    expect(request.url).toBe(SEND_URL);
    expect(request.headers['Content-Type']).toBe('application/json');

    // Official field names: username, password, from, to, text.
    expect(parseBody(request)).toEqual({
      username: USERNAME,
      password: API_KEY,
      from: SENDER,
      to: '09120000000',
      text: 'سلام',
    });
  });

  it('includes the documented backup senders only when configured', async () => {
    const requests: CommunicationHttpRequest[] = [];

    const provider = new RazpayamakCommunicationProvider({
      sendUrl: SEND_URL,
      httpClient: async (request) => {
        requests.push(request);

        return {
          status: 200,
          ok: true,
          text: async () =>
            JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok', Value: '9' }),
        };
      },
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
        fromSupportOne: '200020003000',
        fromSupportTwo: '900090009000',
      }),
    });

    await provider.send(MESSAGE);

    expect(parseBody(requests[0])).toMatchObject({
      fromSupportOne: '200020003000',
      fromSupportTwo: '900090009000',
    });
  });

  it('maps the documented success response to SENT with the provider id', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        Value: '34439078,34439079',
        RetStatus: 1,
        StrRetStatus: 'Ok',
      }),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: '34439078',
    });
  });

  it('reports SENT with a null id when the provider omits Value', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok' }),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: null,
    });
  });

  it('maps the documented 400 error response to FAILED with its message', async () => {
    const { provider } = buildProvider(() => ({
      status: 400,
      rawBody: JSON.stringify({
        ReqStatus: '0',
        Message: 'Username or password is not correct',
      }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result.status).toBe('FAILED');
    expect(result).toHaveProperty(
      'failureReason',
      'Username or password is not correct',
    );
  });

  it('treats a non-success RetStatus as a provider-declared failure', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({ RetStatus: 0, StrRetStatus: 'Failed' }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result.status).toBe('FAILED');
    expect(result).toHaveProperty(
      'failureReason',
      'RazPayamak rejected the request with HTTP status 200.',
    );
  });

  it('normalizes a transport failure into FAILED without swallowing it', async () => {
    const provider = new RazpayamakCommunicationProvider({
      sendUrl: SEND_URL,
      httpClient: async () => {
        throw new Error('socket hang up');
      },
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
      }),
    });

    const result = await provider.send(MESSAGE);

    expect(result.status).toBe('FAILED');
    expect(result).toHaveProperty(
      'failureReason',
      'RazPayamak request failed: socket hang up',
    );
  });

  it('never leaks the credentials through a failure reason', async () => {
    const { provider } = buildProvider(() => ({
      status: 500,
      rawBody: 'upstream error',
    }));

    const result = await provider.send(MESSAGE);

    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(USERNAME);
  });

  it('fails explicitly when the request is made without configuration', async () => {
    const provider = new RazpayamakCommunicationProvider({
      sendUrl: SEND_URL,
      httpClient: async () => ({
        status: 200,
        ok: true,
        text: async () => '{}',
      }),
      getConfig: () => {
        throw new Error(
          'RazPayamak is not configured. Set the following application variable(s): RAZPAYAMAK_API_KEY.',
        );
      },
    });

    await expect(provider.send(MESSAGE)).rejects.toThrow(
      'RAZPAYAMAK_API_KEY',
    );
  });
});
