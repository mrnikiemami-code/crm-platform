import { describe, expect, it } from 'vitest';

import {
  type CommunicationHttpClient,
  type CommunicationHttpRequest,
} from 'src/providers/http/communication-http-client';
import { lookupRazpayamakDelivery } from 'src/providers/razpayamak/razpayamak-delivery.service';

const USERNAME = 'panel-user';
const API_KEY = 'razpayamak-api-key-should-never-leak';
const SENDER = '100020003000';
const DELIVERY_URL = 'https://rest.payamak-panel.test/api/SendSMS/GetDeliveries2';

const build = (respond: (request: CommunicationHttpRequest) => {
  status?: number;
  ok?: boolean;
  rawBody?: string;
  throwOnText?: boolean;
}) => {
  const requests: CommunicationHttpRequest[] = [];

  const httpClient: CommunicationHttpClient = async (request) => {
    requests.push(request);
    const r = respond(request);

    return {
      status: r.status ?? 200,
      ok: r.ok ?? true,
      text: async () => {
        if (r.throwOnText === true) throw new Error('body read failed');
        return r.rawBody ?? '';
      },
    };
  };

  return { requests, httpClient };
};

const config = () => ({ username: USERNAME, apiKey: API_KEY, sender: SENDER });

describe('lookupRazpayamakDelivery', () => {
  it('posts the documented body and returns DELIVERED for code 1', async () => {
    const { httpClient, requests } = build(() => ({
      rawBody: JSON.stringify({ Value: '1', RetStatus: 1, StrRetStatus: 'Ok' }),
    }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({ success: true, state: 'DELIVERED', providerCode: 1 });
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(DELIVERY_URL);
    expect(JSON.parse(requests[0].body ?? '{}')).toEqual({
      username: USERNAME,
      password: API_KEY,
      recID: '555',
    });
  });

  it('maps a not-delivered code without claiming delivery', async () => {
    const { httpClient } = build(() => ({
      rawBody: JSON.stringify({ Value: '2', RetStatus: 1 }),
    }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({
      success: true,
      state: 'NOT_DELIVERED',
      providerCode: 2,
    });
  });

  it('reports NOT_CONFIGURED without calling the provider', async () => {
    const { httpClient, requests } = build(() => ({ rawBody: '{}' }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: () => {
        throw new Error('not configured');
      },
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({ success: false, failureCode: 'NOT_CONFIGURED' });
    expect(requests).toHaveLength(0);
  });

  it('reports LOOKUP_FAILED on a transport error (never a delivery claim)', async () => {
    const httpClient: CommunicationHttpClient = async () => {
      throw new Error('socket hang up');
    };

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({ success: false, failureCode: 'LOOKUP_FAILED' });
  });

  it('reports LOOKUP_FAILED when the body cannot be read', async () => {
    const { httpClient } = build(() => ({ throwOnText: true }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({ success: false, failureCode: 'LOOKUP_FAILED' });
  });

  it('reports LOOKUP_FAILED when RetStatus is not 1', async () => {
    const { httpClient } = build(() => ({
      rawBody: JSON.stringify({ Value: '1', RetStatus: 0 }),
    }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(result).toEqual({ success: false, failureCode: 'LOOKUP_FAILED' });
  });

  it('never leaks the credentials through the result', async () => {
    const { httpClient } = build(() => ({ rawBody: '<html>error</html>' }));

    const result = await lookupRazpayamakDelivery('555', {
      httpClient,
      getConfig: config,
      deliveryUrl: DELIVERY_URL,
    });

    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(result)).not.toContain(USERNAME);
  });
});
