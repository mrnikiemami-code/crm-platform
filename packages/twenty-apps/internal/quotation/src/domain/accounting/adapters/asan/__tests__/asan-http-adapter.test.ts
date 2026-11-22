import { describe, expect, it } from 'vitest';

import {
  AsanHttpAdapter,
  type AsanFetch,
  readBoundedResponseText,
} from 'src/domain/accounting/adapters/asan/asan-http-adapter';

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

const fakeFetch = (
  response: { status?: number; text?: string } | Error,
): { fetchImpl: AsanFetch; calls: Call[] } => {
  const calls: Call[] = [];

  const fetchImpl: AsanFetch = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      ...(init.body === undefined ? {} : { body: init.body }),
    });

    if (response instanceof Error) {
      throw response;
    }

    return {
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      text: async () => response.text ?? '',
    };
  };

  return { fetchImpl, calls };
};

const adapter = (
  overrides: Partial<ConstructorParameters<typeof AsanHttpAdapter>[0]> = {},
  fetchImpl?: AsanFetch,
) =>
  new AsanHttpAdapter({
    baseUrl: 'http://127.0.0.1:8080/api',
    remoteUserId: '7',
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
    now: () => new Date('2026-11-21T08:00:00.000Z'),
    ...overrides,
  });

describe('asan health check', () => {
  it('reports a documented read answered over plain http as reachable but insecure', async () => {
    const fake = fakeFetch({ text: '[]' });
    const health = await adapter({}, fake.fetchImpl).testConnection();

    expect(health).toEqual({
      ok: true,
      value: {
        kind: 'REACHABLE',
        checkedAt: '2026-11-21T08:00:00.000Z',
        latencyMs: expect.any(Number),
        transportIsSecure: false,
        detail: expect.stringContaining('plain HTTP'),
      },
    });
    expect(fake.calls[0].url).toBe(
      'http://127.0.0.1:8080/api/ProductsNew/LastProducts?Count=1',
    );
  });

  it('reports an HTTP error as an unreadable response, not as reachable', async () => {
    const fake = fakeFetch({ status: 500, text: 'boom' });
    const health = await adapter({}, fake.fetchImpl).testConnection();

    expect(health).toMatchObject({
      ok: true,
      value: { kind: 'UNREACHABLE', code: 'INVALID_RESPONSE' },
    });
  });

  it('reports a transport failure as unreachable', async () => {
    const fake = fakeFetch(new TypeError('connect ECONNREFUSED'));
    const health = await adapter({}, fake.fetchImpl).testConnection();

    expect(health).toMatchObject({
      ok: true,
      value: { kind: 'UNREACHABLE', code: 'TRANSPORT_ERROR' },
    });
  });

  it('reports a timeout distinctly, without guessing the vendor state', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    const fake = fakeFetch(timeout);
    const health = await adapter({}, fake.fetchImpl).testConnection();

    expect(health).toMatchObject({
      ok: true,
      value: { kind: 'UNREACHABLE', code: 'TIMEOUT' },
    });
  });
});

describe('asan product read', () => {
  it('maps the documented product array and derives a stable version marker', async () => {
    const text = JSON.stringify([
      {
        ProductCode: 1001,
        ProductName: 'کابل شبکه',
        ProductName2: 'CAT6',
        SellPrice: 450000,
        SalesPrice: [430000, 420000],
        Stock: 12,
      },
    ]);
    const first = await adapter({}, fakeFetch({ text }).fetchImpl).listItems();

    expect(first).toMatchObject({
      ok: true,
      value: [
        {
          externalItemId: '1001',
          code: '1001',
          name: 'کابل شبکه',
          secondaryName: 'CAT6',
          sellPriceUnits: 450000,
          salesPriceUnits: [430000, 420000],
          stock: 12,
        },
      ],
    });

    const second = await adapter({}, fakeFetch({ text }).fetchImpl).listItems();

    expect(first.ok && first.value[0].remoteVersion).toBe(
      second.ok && second.value[0].remoteVersion,
    );
  });

  it('changes the version marker when the remote record content changes', async () => {
    const before = await adapter(
      {},
      fakeFetch({ text: JSON.stringify([{ ProductCode: 1001, ProductName: 'الف', SellPrice: 1 }]) })
        .fetchImpl,
    ).listItems();
    const after = await adapter(
      {},
      fakeFetch({ text: JSON.stringify([{ ProductCode: 1001, ProductName: 'ب', SellPrice: 1 }]) })
        .fetchImpl,
    ).listItems();

    expect(before.ok && before.value[0].remoteVersion).not.toBe(
      after.ok && after.value[0].remoteVersion,
    );
  });

  it('skips a row without a usable ProductCode instead of fabricating an identity', async () => {
    const items = await adapter(
      {},
      fakeFetch({
        text: JSON.stringify([
          { ProductCode: 1001, ProductName: 'درست' },
          { ProductName: 'بدون کد' },
          { ProductCode: -5, ProductName: 'کد منفی' },
        ]),
      }).fetchImpl,
    ).listItems();

    expect(items.ok && items.value.map((item) => item.externalItemId)).toEqual(['1001']);
  });

  it('accepts a documented-looking envelope and refuses anything else', async () => {
    const enveloped = await adapter(
      {},
      fakeFetch({ text: JSON.stringify({ data: [{ ProductCode: 1001 }] }) }).fetchImpl,
    ).listItems();
    expect(enveloped.ok && enveloped.value).toHaveLength(1);

    const unreadable = await adapter(
      {},
      fakeFetch({ text: JSON.stringify({ items: [] }) }).fetchImpl,
    ).listItems();
    expect(unreadable).toMatchObject({
      ok: false,
      refusal: { code: 'INVALID_RESPONSE' },
    });
  });

  it('reports a non-JSON answer as unreadable', async () => {
    expect(
      await adapter({}, fakeFetch({ text: '<html>error</html>' }).fetchImpl).listItems(),
    ).toMatchObject({ ok: false, refusal: { code: 'INVALID_RESPONSE' } });
  });
});

describe('asan write transport gate', () => {
  it('refuses a write over plain http without explicit approval, before any request', async () => {
    const fake = fakeFetch({ text: '1' });
    const result = await adapter({}, fake.fetchImpl).createItem({
      externalItemId: '1001',
      code: '1001',
      name: 'کالا',
      secondaryName: null,
      sellPriceUnits: 1000,
      salesPriceUnits: [],
    });

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'TRANSPORT_NOT_APPROVED' },
    });
    expect(fake.calls).toEqual([]);
  });

  it('sends the tunnel token and the documented create path when approved', async () => {
    const fake = fakeFetch({ text: '1' });
    const result = await adapter(
      { allowInsecureTransport: true, tunnelToken: 'tunnel-secret' },
      fake.fetchImpl,
    ).createItem({
      externalItemId: '1001',
      code: '1001',
      name: 'کالا',
      secondaryName: null,
      sellPriceUnits: 1000,
      salesPriceUnits: [],
    });

    expect(result.ok).toBe(true);
    expect(fake.calls[0].url).toBe('http://127.0.0.1:8080/api/Products4/AddProduct');
    expect(fake.calls[0].headers.Authorization).toBe('Bearer tunnel-secret');
    expect(JSON.parse(fake.calls[0].body ?? '{}')).toMatchObject({
      ProductCode: 1001,
      ProductName: 'کالا',
      SellPrice: 1000,
    });
  });

  it('sends writes over https without any extra approval', async () => {
    const fake = fakeFetch({ text: '1' });
    const result = await adapter(
      { baseUrl: 'https://accounting.example/api' },
      fake.fetchImpl,
    ).createItem({
      externalItemId: '1001',
      code: '1001',
      name: 'کالا',
      secondaryName: null,
      sellPriceUnits: 1000,
      salesPriceUnits: [],
    });

    expect(result.ok).toBe(true);
    expect(fake.calls[0].url.startsWith('https://')).toBe(true);
  });

  it('keeps the current sales price tiers on a price edit', async () => {
    const fake = fakeFetch({ text: '1' });
    await adapter(
      { baseUrl: 'https://accounting.example/api' },
      fake.fetchImpl,
    ).updateItemPrices({
      externalItemId: '1001',
      code: '1001',
      name: 'کالا',
      secondaryName: null,
      sellPriceUnits: 2000,
      salesPriceUnits: [1900, 1800],
    });

    expect(JSON.parse(fake.calls[0].body ?? '{}')).toMatchObject({
      SellPrice: 2000,
      SalesPrice: [1900, 1800],
    });
  });
});

describe('asan document registration', () => {
  const payload = { FactorNumber: 0 };

  it('treats zero as NOT registered and refuses to call it success', async () => {
    const result = await adapter(
      { baseUrl: 'https://accounting.example/api' },
      fakeFetch({ text: '0' }).fetchImpl,
    ).registerProforma({ payload, description: 'پیش‌فاکتور' });

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'ASAN_DOCUMENT_NOT_REGISTERED' },
    });
  });

  it('reports the positive document number as the only proof of registration', async () => {
    const result = await adapter(
      { baseUrl: 'https://accounting.example/api' },
      fakeFetch({ text: '501' }).fetchImpl,
    ).registerProforma({ payload, description: 'پیش‌فاکتور' });

    expect(result).toEqual({
      ok: true,
      value: {
        externalDocumentId: '501',
        documentNumber: '501',
        registeredAt: '2026-11-21T08:00:00.000Z',
      },
    });
  });

  it('refuses an undocumented answer rather than assuming the document exists', async () => {
    const result = await adapter(
      { baseUrl: 'https://accounting.example/api' },
      fakeFetch({ text: '{"result":"maybe"}' }).fetchImpl,
    ).registerProforma({ payload, description: 'پیش‌فاکتور' });

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'VENDOR_UNDOCUMENTED' },
    });
  });
});

describe('asan response body budget', () => {
  const streamed = (
    chunks: string[],
    declaredLength?: string,
  ): {
    response: Parameters<typeof readBoundedResponseText>[0];
    readerCalls: () => number;
    cancellations: () => number;
  } => {
    const encoder = new TextEncoder();
    let index = 0;
    let reads = 0;
    let cancelled = 0;

    return {
      readerCalls: () => reads,
      cancellations: () => cancelled,
      response: {
        ok: true,
        status: 200,
        headers: { get: () => declaredLength ?? null },
        body: {
          getReader: () => ({
            read: async () => {
              reads += 1;

              if (index >= chunks.length) {
                return { done: true };
              }

              const value = encoder.encode(chunks[index]);
              index += 1;

              return { done: false, value };
            },
            cancel: async () => {
              cancelled += 1;
            },
          }),
        },
        text: async () => {
          throw new Error('the buffered path must not run when a stream is present');
        },
      },
    };
  };

  it('aborts a streamed body as soon as the byte ceiling is crossed', async () => {
    const fake = streamed(['a'.repeat(1024), 'b'.repeat(1024), 'c'.repeat(1024)]);

    const result = await readBoundedResponseText(fake.response, 1500);

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'REMOTE_DATASET_TOO_LARGE' },
    });
    expect(fake.cancellations()).toBe(1);
    // Two chunks were read: the second one is what crossed the budget. The third never
    // arrived, which is the whole point of aborting mid-body.
    expect(fake.readerCalls()).toBe(2);
  });

  it('refuses on a declared content-length above the ceiling without reading the body', async () => {
    const fake = streamed(['small'], '104857600');

    const result = await readBoundedResponseText(fake.response, 1024);

    expect(result).toMatchObject({
      ok: false,
      refusal: { code: 'REMOTE_DATASET_TOO_LARGE' },
    });
    expect(fake.readerCalls()).toBe(0);
    expect(fake.cancellations()).toBe(0);
  });

  it('reads a body inside the budget to the end', async () => {
    const fake = streamed(['{"data":', '[]}']);

    const result = await readBoundedResponseText(fake.response, 1024);

    expect(result).toEqual({ ok: true, value: '{"data":[]}' });
    expect(fake.cancellations()).toBe(0);
  });

  it('measures real utf-8 bytes when the runtime exposes no stream', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: null,
      text: async () => 'کالا',
    };

    // Four Persian characters are eight bytes, not four: a character count would let this
    // through and then claim the ceiling had been honoured.
    const refusedResult = await readBoundedResponseText(response, 6);
    const acceptedResult = await readBoundedResponseText(response, 8);

    expect(refusedResult).toMatchObject({ ok: false });
    expect(acceptedResult).toEqual({ ok: true, value: 'کالا' });
  });

  it('stops the adapter read at the ceiling instead of buffering the whole list', async () => {
    const previous = process.env.ACCOUNTING_REMOTE_RESPONSE_MAX_BYTES;
    process.env.ACCOUNTING_REMOTE_RESPONSE_MAX_BYTES = '1024';

    try {
      const fake = streamed(['a'.repeat(700), 'b'.repeat(700)]);
      const fetchImpl: AsanFetch = async () => fake.response;
      const result = await adapter({}, fetchImpl).listItems();

      expect(result).toMatchObject({
        ok: false,
        refusal: { code: 'REMOTE_DATASET_TOO_LARGE' },
      });
      expect(fake.cancellations()).toBe(1);
      expect(fake.readerCalls()).toBe(2);
    } finally {
      if (previous === undefined) {
        delete process.env.ACCOUNTING_REMOTE_RESPONSE_MAX_BYTES;
      } else {
        process.env.ACCOUNTING_REMOTE_RESPONSE_MAX_BYTES = previous;
      }
    }
  });
});
