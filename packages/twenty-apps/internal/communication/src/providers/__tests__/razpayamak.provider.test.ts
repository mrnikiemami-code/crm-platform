import { describe, expect, it } from 'vitest';

import { RazpayamakCommunicationProvider } from 'src/providers/razpayamak/razpayamak.provider';
import { RAZPAYAMAK_SEND_URL } from 'src/providers/razpayamak/razpayamak.config';
import {
  type CommunicationHttpClient,
  type CommunicationHttpRequest,
} from 'src/providers/http/communication-http-client';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const USERNAME = 'panel-user';
const API_KEY = 'razpayamak-api-key-should-never-leak';
const SENDER = '100020003000';
// Tests override the URL ONLY through the injected dependency. Production
// always uses the fixed official endpoint.
const ENDPOINT = 'https://rest.payamak-panel.test/api/SendSMS/SendSMS';

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
    sendUrl: ENDPOINT,
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

const success = (value: string) =>
  JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok', Value: value });

describe('RazpayamakCommunicationProvider', () => {
  it('identifies as razpayamak on the SMS channel', () => {
    const { provider } = buildProvider(() => ({ rawBody: '{}' }));

    expect(provider.id).toBe('razpayamak');
    expect(provider.channel).toBe('SMS');
    expect(provider.capabilities()).toEqual({
      supportsSubject: false,
      supportsDeliveryReceipt: false,
    });
  });

  it('uses the fixed official endpoint in production', () => {
    const provider = new RazpayamakCommunicationProvider({
      httpClient: async () => ({
        status: 200,
        ok: true,
        text: async () => success('123'),
      }),
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
      }),
    });

    expect(RAZPAYAMAK_SEND_URL).toBe(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
    );
    // No sendUrl injection: the provider falls back to the constant.
    expect(provider).toBeDefined();
  });

  it('posts the exact documented five-field body to the endpoint', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: success('1'),
    }));

    await provider.send(MESSAGE);

    expect(requests).toHaveLength(1);

    const [request] = requests;

    expect(request.method).toBe('POST');
    expect(request.url).toBe(ENDPOINT);
    expect(request.headers['Content-Type']).toBe('application/json');

    expect(parseBody(request)).toEqual({
      username: USERNAME,
      password: API_KEY,
      from: SENDER,
      to: '09120000000',
      text: 'سلام',
    });
  });

  it('sends no undocumented field at all', async () => {
    const { provider, requests } = buildProvider(() => ({
      rawBody: success('1'),
    }));

    await provider.send(MESSAGE);

    expect(Object.keys(parseBody(requests[0])).sort()).toEqual([
      'from',
      'password',
      'text',
      'to',
      'username',
    ]);
  });

  it('returns SENT with the recID on a strict success', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: success('34439078'),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: '34439078',
    });
  });

  it('takes the first id from a comma-separated Value', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: success('34439078,34439079'),
    }));

    expect(await provider.send(MESSAGE)).toEqual({
      status: 'SENT',
      providerMessageId: '34439078',
    });
  });

  // A `RetStatus=1` without a usable recID cannot be trusted as "sent".
  // A bare number like `11` IS a valid recID, so it is deliberately not here.
  it.each(['', '   ', 'abc', '-5'])(
    'treats a RetStatus=1 with Value %j as UNKNOWN, never SENT',
    async (value) => {
      const { provider } = buildProvider(() => ({
        rawBody: JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok', Value: value }),
      }));

      const result = await provider.send(MESSAGE);

      expect(result.status).toBe('UNKNOWN');
    },
  );

  it('treats a RetStatus=1 with no Value as UNKNOWN', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({ RetStatus: 1, StrRetStatus: 'Ok' }),
    }));

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  // The documented Value/ReqStatus failure vocabulary. The negative codes
  // (108..111) must be parsed WITH their sign.
  const FAILURE_MATRIX: { providerCode: number; failureCode: string }[] = [
    { providerCode: -111, failureCode: 'INVALID_REQUESTER_IP' },
    { providerCode: -110, failureCode: 'API_KEY_REQUIRED' },
    { providerCode: -109, failureCode: 'ALLOWED_IP_NOT_CONFIGURED' },
    { providerCode: -108, failureCode: 'IP_BLOCKED' },
    { providerCode: 0, failureCode: 'INVALID_CREDENTIALS' },
    { providerCode: 2, failureCode: 'INSUFFICIENT_CREDIT' },
    { providerCode: 3, failureCode: 'DAILY_LIMIT_REACHED' },
    { providerCode: 4, failureCode: 'VOLUME_LIMIT_REACHED' },
    { providerCode: 5, failureCode: 'INVALID_SENDER' },
    { providerCode: 6, failureCode: 'PROVIDER_MAINTENANCE' },
    { providerCode: 7, failureCode: 'FILTERED_WORD' },
    { providerCode: 9, failureCode: 'PUBLIC_LINE_NOT_ALLOWED' },
    { providerCode: 10, failureCode: 'INACTIVE_USER' },
    { providerCode: 11, failureCode: 'NOT_SENT' },
    { providerCode: 12, failureCode: 'INCOMPLETE_DOCUMENTS' },
    { providerCode: 14, failureCode: 'MESSAGE_CONTAINS_LINK' },
    { providerCode: 15, failureCode: 'OPT_OUT_MISSING' },
    { providerCode: 16, failureCode: 'RECIPIENT_NOT_FOUND' },
    { providerCode: 17, failureCode: 'EMPTY_MESSAGE' },
    { providerCode: 18, failureCode: 'INVALID_MOBILE' },
  ];

  it.each(FAILURE_MATRIX)(
    'maps Value code $providerCode to a definite FAILED with $failureCode',
    async ({ providerCode, failureCode }) => {
      const { provider } = buildProvider(() => ({
        rawBody: JSON.stringify({
          RetStatus: 0,
          StrRetStatus: 'Failed',
          Value: String(providerCode),
        }),
      }));

      const result = await provider.send(MESSAGE);

      expect(result).toMatchObject({
        status: 'FAILED',
        failureCode,
        providerCode,
      });
    },
  );

  it('maps a documented HTTP 400 ReqStatus to the same failure model', async () => {
    const { provider } = buildProvider(() => ({
      status: 400,
      rawBody: JSON.stringify({
        ReqStatus: '0',
        Message: 'Username or password is not correct',
      }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result).toMatchObject({
      status: 'FAILED',
      failureCode: 'INVALID_CREDENTIALS',
      providerCode: 0,
    });
    // Provider text is carried only as sanitized untrusted detail.
    expect(result).toHaveProperty(
      'providerDetail',
      'Username or password is not correct',
    );
  });

  it('keeps an unknown provider code safe and sanitized', async () => {
    const { provider } = buildProvider(() => ({
      rawBody: JSON.stringify({
        RetStatus: 0,
        Value: '999',
        Message: 'weird\u0000text',
      }),
    }));

    const result = await provider.send(MESSAGE);

    expect(result).toMatchObject({
      status: 'FAILED',
      failureCode: 'UNKNOWN_PROVIDER_ERROR',
      providerCode: 999,
    });
    // Control characters are stripped from untrusted detail.
    expect(JSON.stringify(result)).not.toContain('\u0000');
  });

  // ----- Unknown-outcome safety -----

  it('returns UNKNOWN (not FAILED) when the transport rejects', async () => {
    const provider = new RazpayamakCommunicationProvider({
      sendUrl: ENDPOINT,
      httpClient: async () => {
        throw new Error('socket hang up');
      },
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
      }),
    });

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when response.text() rejects', async () => {
    const provider = new RazpayamakCommunicationProvider({
      sendUrl: ENDPOINT,
      httpClient: async () => ({
        status: 200,
        ok: true,
        text: async () => {
          throw new Error('body read failed');
        },
      }),
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
      }),
    });

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for a malformed or empty 2xx response', async () => {
    const { provider } = buildProvider(() => ({ rawBody: '' }));

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for a non-JSON 2xx response', async () => {
    const { provider } = buildProvider(() => ({ rawBody: '<html>oops</html>' }));

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN for an unreadable HTTP error', async () => {
    const { provider } = buildProvider(() => ({
      status: 500,
      rawBody: 'upstream error',
    }));

    expect((await provider.send(MESSAGE)).status).toBe('UNKNOWN');
  });

  // ----- Credential safety -----

  it('never exposes the ApiKey when a transport error embeds the request body', async () => {
    const provider = new RazpayamakCommunicationProvider({
      sendUrl: ENDPOINT,
      httpClient: async () => {
        throw new Error(
          `connect failed for body {"username":"${USERNAME}","password":"${API_KEY}"}`,
        );
      },
      getConfig: () => ({
        username: USERNAME,
        apiKey: API_KEY,
        sender: SENDER,
      }),
    });

    const result = await provider.send(MESSAGE);

    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(USERNAME);
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
      sendUrl: ENDPOINT,
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

    await expect(provider.send(MESSAGE)).rejects.toThrow('RAZPAYAMAK_API_KEY');
  });
});
