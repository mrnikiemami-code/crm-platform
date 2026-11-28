import { describe, expect, it } from 'vitest';
import { mergeSourcePartyProfile } from 'src/domain/accounting/party-profile';

import {
  AsanHttpAdapter,
  type AsanFetch,
  readBoundedResponseText,
  parseParty,
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
    baseUrl: 'https://accounting.example/api',
    remoteUserId: '7',
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
    now: () => new Date('2026-11-21T08:00:00.000Z'),
    ...overrides,
  });

describe('asan health check', () => {
  it('fails closed without an explicitly injected approved transport', async () => {
    // No DNS lookup, no global fetch and no token-bearing request may happen.
    expect(await adapter({ tunnelToken: 'fixture-secret' }).listItems()).toMatchObject({
      ok: false, refusal: { code: 'ASAN_TRANSPORT_UNAVAILABLE' },
    });
  });
  it('rejects a read-only adapter write before it reaches the injected transport', async () => {
    const fake = fakeFetch({ text: '501' });
    const result = await adapter({ readOnly: true }, fake.fetchImpl).registerProforma({ payload: {}, description: 'test' });
    expect(result).toMatchObject({ ok: false, refusal: { code: 'ASAN_LIVE_WRITE_NOT_APPROVED' } });
    expect(fake.calls).toEqual([]);
  });

  it('refuses a cleartext health probe even when legacy approval and token exist', async () => {
    const fake = fakeFetch({ text: '[]' });
    const health = await adapter({
      baseUrl: 'http://127.0.0.1:8080/api',
      allowInsecureTransport: true,
      tunnelToken: 'fixture-secret',
    }, fake.fetchImpl).testConnection();
    expect(health).toMatchObject({
      ok: true,
      value: { kind: 'UNREACHABLE', transportIsSecure: false },
    });
    expect(fake.calls).toEqual([]);
  });

  it('rejects base URLs with userinfo, query or fragment before any request', async () => {
    for (const baseUrl of ['https://user:pass@accounting.example/api', 'https://accounting.example/api?token=x', 'https://accounting.example/api#x']) {
      const fake = fakeFetch({ text: '[]' });
      expect(await adapter({ baseUrl }, fake.fetchImpl).listParties()).toMatchObject({
        ok: false, refusal: { code: 'TRANSPORT_NOT_APPROVED' },
      });
      expect(fake.calls).toEqual([]);
    }
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

describe('guide 32-page response contract', () => {
  it('reads CustomerServiceViewModel output fields rather than write input names', async () => {
    const raw = { Code: 801001, FullName: 'شرکت آزمون', Parent: 801,
      NationalCode: '0012345678', Mobile: '09120000000', EconomicCode: '00120003',
      Address: 'تهران', Tellephone: '02111111111', Tellephone2: '02122222222',
      Fax: '02133333333', PostalCode: '0012345678', AccountGroup: 'الف',
      Gender: 0, GenderTitle: 'ماهیت حساب', SettlementDays: 15 };
    const result = await adapter({}, fakeFetch({ text: JSON.stringify([raw]) }).fetchImpl).listParties();
    expect(result).toMatchObject({ ok: true, value: [{
      externalPartyId: '801001', code: '801001', fullName: raw.FullName,
      nationalCode: raw.NationalCode, mobile: raw.Mobile, economicCode: raw.EconomicCode,
      address: raw.Address, firstPhone: raw.Tellephone, secondPhone: raw.Tellephone2,
      fax: raw.Fax, postalCode: raw.PostalCode, accountGroup: raw.AccountGroup, settlementDays: 15,
    }] });
    expect(parseParty(raw)?.partyType).toBeUndefined();
    expect(parseParty({ ...raw, PersonCode: 801002 })).toBeNull();
    expect(parseParty({ PersonCode: 801001, PersonFullName: 'قدیمی' })?.fullName).toBe('قدیمی');
  });
  it('reads documented TotalCount, including zero, without replacing it by a legacy alias', async () => {
    const result = await adapter({}, fakeFetch({ text: JSON.stringify([
      { ProductCode: 101, ProductName: 'کالا', TotalCount: 0, Stock: 99, SellPrice: 1000 },
      { ProductCode: 102, ProductName: 'کالا', TotalCount: 12.5 },
    ]) }).fetchImpl).listItems();
    expect(result).toMatchObject({ ok: true, value: [{ stock: 0 }, { stock: 12.5 }] });
  });
  it('does not mark an HTTP 200 HTML page or malformed product body reachable', async () => {
    for (const body of ['<html>Login</html>', '{}', '[{"ProductCode":0}]']) {
      expect(await adapter({}, fakeFetch({ text: body }).fetchImpl).testConnection())
        .toMatchObject({ ok: true, value: { kind: 'UNREACHABLE', code: 'INVALID_RESPONSE' } });
    }
  });
});
describe('source-owned customer observations', () => {
  it('keeps account nature and source price group without publishing balances or inferring party type', () => {
    const party = parseParty({ Code: '123456789012345678', FullName: 'آزمون', Parent: 0,
      Gender: 3, GenderTitle: 'حساب', AccountGroupPriceList: 4, VisitorID: 7, VisitorPercent: 0,
      Remain: 1000, BookCredit: 2000, ChequeCredit: 3000 });
    expect(party).toMatchObject({ externalPartyId: '123456789012345678',
      sourceObservation: { version: '1', parentId: '0', accountNatureCode: 3,
        accountNatureLabel: 'حساب', priceListId: '4', representativeId: '7', representativePercent: 0 } });
    expect(party?.partyType).toBeUndefined();
    expect(party).not.toHaveProperty('Remain');
    const merged = mergeSourcePartyProfile(party!, null);
    expect(JSON.parse(merged!)).toMatchObject({ sourceObservation: { accountNatureCode: 3, representativePercent: 0 } });
    expect(merged).not.toContain('BookCredit');
    expect(parseParty({ Code: 9007199254740992, FullName: 'نامعتبر' })).toBeNull();
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

  it('does not change the version marker when JSON property order changes', async () => {
    const first = await adapter({}, fakeFetch({ text: '[{"ProductCode":1001,"ProductName":"A","Extra":{"a":1,"b":2}}]' }).fetchImpl).listItems();
    const second = await adapter({}, fakeFetch({ text: '[{"Extra":{"b":2,"a":1},"ProductName":"A","ProductCode":1001}]' }).fetchImpl).listItems();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.ok && first.value[0].remoteVersion).toBe(second.ok && second.value[0].remoteVersion);
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

  it('refuses an incomplete product snapshot instead of silently dropping identities', async () => {
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

    expect(items).toMatchObject({ ok: false, refusal: { code: 'ASAN_INCOMPLETE_DATASET' } });
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

const sequencedFetch = (...responses: string[]): ReturnType<typeof fakeFetch> => {
  const calls: Call[] = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, ...(init.body === undefined ? {} : { body: init.body }) });
      const response = responses.shift();
      if (response === undefined) throw new Error('unexpected vendor call');
      return { ok: true, status: 200, text: async () => response };
    },
  };
};
const productReadback = (price: number, tiers: number[] = []) =>
  JSON.stringify({ ProductCode: 1001, ProductName: 'کالا', SellPrice: price, SalesPrice: tiers });

describe('Asan typed installation reads', () => {
  it('retains price positions and units without inferring warehouse identity', async () => {
    const raw = { ProductCode: 1001, ProductName: 'کالا', SalesPrice10: [0, '9007199254740993'],
      StoreProduct: [0, 2.5], ProductUnitID: 7, ProductUnitTitle: 'عدد',
      SecondUnitTitle: 'بسته', ProductUnitCount: 12, TaxID: '64',
      parent: 0, ProductSize: 'L', Size: '42', ProductSerial: 'A1', Serials: ['A1','A2'],
      SellPrice3: 0, SellPrice4: '9007199254740993', VisitorPercent: 0, Karton: 12,
      BuyPrice: 100, LastBuyPrice: 200 };
    const fake = fakeFetch({ text: JSON.stringify(raw) });
    expect(await adapter({}, fake.fetchImpl).readItem('1001')).toMatchObject({ ok: true, value: {
      observation: { version: '1', priceUnitsByPosition: ['0', '9007199254740993'], stockByPosition: [0, 2.5],
        unitId: '7', unitName: 'عدد', secondaryUnitName: 'بسته', unitCount: 12, taxCode: '64',
        parentId: '0', primarySize: 'L', secondarySize: '42', serial: 'A1', serials: ['A1','A2'],
        thirdSellPriceUnits: '0', fourthSellPriceUnits: '9007199254740993', representativePercent: 0, unitsPerCarton: 12 },
    } });
    expect(fake.calls[0].url).toContain('OneProductWithoutSerial?ProductCode=1001');
  });
  it('reads exact prices, named stores and explicit store stock, preserving zero', async () => {
    const fake = sequencedFetch(
      '[{"ProductCode":1001,"ProductName":"A","parent":0,"PriceList":[0,"9007199254740993"],"StoreProduct":[0]}]',
      '[{"StoreID":2,"StoreName":"انبار"}]', '0');
    const instance = adapter({}, fake.fetchImpl);
    expect(await instance.listPrices()).toMatchObject({ ok: true, value: [{
      externalItemId: '1001', parentId: null, priceUnitsByPosition: ['0', '9007199254740993'], stockByPosition: [0],
    }] });
    expect(await instance.listStores()).toEqual({ ok: true, value: [{ externalStorageId: '2', name: 'انبار' }] });
    expect(await instance.readStockByStore('1001', '2')).toEqual({ ok: true, value: 0 });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET', 'GET', 'GET']);
    expect(fake.calls[2].url).toContain('ProductStock?ProductCode=1001&StoreID=2');
  });
  it('refuses unsafe numbers and unrelated mobile results', async () => {
    const fake = sequencedFetch('[{"ProductCode":1001,"ProductName":"A","parent":0,"PriceList":[9007199254740993],"StoreProduct":[]}]',
      '[{"Code":1,"FullName":"A","Mobile":"09350000000"}]');
    const instance = adapter({}, fake.fetchImpl);
    expect(await instance.listPrices()).toMatchObject({ ok: false, refusal: { code: 'ASAN_INCOMPLETE_DATASET' } });
    expect(await instance.readPartiesByMobile('09120000000')).toMatchObject({ ok: false, refusal: { code: 'ASAN_INCOMPLETE_DATASET' } });
  });
});

describe('asan write transport gate', () => {
  it('refuses a write over plain http even with legacy approval, before any request', async () => {
    const fake = fakeFetch({ text: '1' });
    const result = await adapter({ baseUrl: 'http://127.0.0.1:8080/api', allowInsecureTransport: true }, fake.fetchImpl).createItem({
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
    const fake = sequencedFetch('[]', '1', productReadback(1000));
    const result = await adapter(
      { baseUrl: 'https://accounting.example/api', tunnelToken: 'tunnel-secret' },
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
    expect(fake.calls[0].url).toBe('https://accounting.example/api/ProductsNew/AllProducts');
    expect(fake.calls[1].url).toBe('https://accounting.example/api/Products4/AddProduct');
    expect(fake.calls[1].headers.Authorization).toBe('Bearer tunnel-secret');
    expect(JSON.parse(fake.calls[1].body ?? '{}')).toMatchObject({
      ProductCode: 1001,
      ProductName: 'کالا',
      SellPrice: 1000,
    });
  });

  it('sends writes over https without any extra approval', async () => {
    const fake = sequencedFetch('[]', '1', productReadback(1000));
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
    const fake = sequencedFetch(productReadback(1000, [1900, 1800]), '1', productReadback(2000, [1900, 1800]));
    const result = await adapter(
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

    expect(result.ok).toBe(true);
    expect(JSON.parse(fake.calls[1].body ?? '{}')).toMatchObject({
      SellPrice: 2000,
      SalesPrice: [1900, 1800],
    });
  });
});

describe('Asan write integrity', () => {
  it('refuses HTTP 200 with zero or malformed result and requires exact product readback', async () => {
    const input = { externalItemId: '1001', code: '1001', name: 'کالا', secondaryName: null, sellPriceUnits: 1000, salesPriceUnits: [0, 100] };
    for (const code of ['0', '""', '1.5', '<html>']) {
      const fake = sequencedFetch('[]', code);
      expect(await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl).createItem(input)).toMatchObject({ ok: false, refusal: { code: 'ASAN_WRITE_UNCONFIRMED' } });
      expect(fake.calls).toHaveLength(2);
    }
    const fake = sequencedFetch('[]', '1', productReadback(1000, [0, 100]));
    expect(await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl).createItem(input)).toMatchObject({ ok: true, value: { salesPriceUnits: [0, 100] } });
    expect(JSON.parse(fake.calls[1].body ?? '{}').SalesPrice).toEqual([0, 100]);
  });
  it('refuses a create when the documented complete read already contains the code', async () => {
    const fake = sequencedFetch('[{"ProductCode":1001,"ProductName":"Existing"}]');
    const result = await adapter({}, fake.fetchImpl).createItem({ externalItemId: '1001', code: '1001',
      name: 'کالا', secondaryName: null, sellPriceUnits: 1000, salesPriceUnits: [] });
    expect(result).toMatchObject({ ok: false, refusal: { code: 'ASAN_PRODUCT_ALREADY_EXISTS' } });
    expect(fake.calls.map((call) => call.method)).toEqual(['GET']);
  });
  it('preserves exact long product identity on read and rejects rounded numeric identity', async () => {
    const fake = sequencedFetch('{"ProductCode":"9007199254740993","ProductName":"کالا"}',
      '{"ProductCode":9007199254740993,"ProductName":"کالا"}');
    const instance = adapter({}, fake.fetchImpl);
    expect(await instance.readItem('9007199254740993')).toMatchObject({ ok: true, value: { externalItemId: '9007199254740993' } });
    expect(await instance.readItem('9007199254740993')).toMatchObject({ ok: false });
  });
  it('preserves unspecified price positions instead of erasing them', async () => {
    const fake = sequencedFetch(productReadback(1000, [0, 1800]), '1', productReadback(2000, [0, 1800]));
    const result = await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl).updateItemPrices({ externalItemId: '1001', code: '1001', name: 'کالا', secondaryName: null, sellPriceUnits: 2000, salesPriceUnits: [] });
    expect(result.ok).toBe(true);
    expect(JSON.parse(fake.calls[1].body ?? '{}').SalesPrice).toEqual([0, 1800]);
  });
  const partyInput = { externalPartyId: '801001', fullName: 'علی محمدی', mobile: '09120000000', nationalCode: '0012345678', address: null };
  const partyRecord = { Code: 801001, FullName: 'علی محمدی', Mobile: '09120000000', NationalCode: '0012345678', Address: 'تهران', EconomicCode: '001234567890', PostalCode: '', Tellephone: '02111111111', Tellephone2: '', Fax: '', AccountGroup: 'الف', Gender: 3 };
  it('reads and preserves all replacement customer fields and account nature', async () => {
    const fake = sequencedFetch(JSON.stringify([partyRecord]), '1', JSON.stringify([partyRecord]));
    const result = await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl).updateParty(partyInput);
    expect(result).toMatchObject({ ok: true, value: { externalPartyId: '801001', address: 'تهران' } });
    expect(JSON.parse(fake.calls[1].body ?? '{}')).toMatchObject({ PersonGender: 3, PersonAddress: 'تهران', PersonEcoCode: '001234567890', PersonFirstTell: '02111111111', PersonSecoundTell: '', PersonFax: '', PersonPostalCode: '', PersonAccountGroup: 'الف' });
    const incomplete = sequencedFetch(JSON.stringify([{ ...partyRecord, Address: undefined }]));
    expect(await adapter({ baseUrl: 'https://accounting.example/api' }, incomplete.fetchImpl).updateParty(partyInput)).toMatchObject({ ok: false, refusal: { code: 'ASAN_CUSTOMER_PROFILE_INCOMPLETE' } });
    expect(incomplete.calls).toHaveLength(1);
  });
  it('requires unique customer create readback; never reports an empty assigned code as success', async () => {
    const fake = sequencedFetch('[]', '1', '[]');
    expect(await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl).createParty({ ...partyInput, externalPartyId: null })).toMatchObject({ ok: false, refusal: { code: 'ASAN_WRITE_UNCONFIRMED' } });
    const fieldsDiffer = sequencedFetch('[]', '1', JSON.stringify([{ ...partyRecord, Gender: 0 }]));
    expect(await adapter({}, fieldsDiffer.fetchImpl).createParty({ ...partyInput, externalPartyId: null, address: 'نشانی جدید' }))
      .toMatchObject({ ok: false, refusal: { code: 'ASAN_WRITE_UNCONFIRMED' } });
    const existing = sequencedFetch(JSON.stringify([partyRecord]));
    expect(await adapter({ baseUrl: 'https://accounting.example/api' }, existing.fetchImpl).createParty({ ...partyInput, externalPartyId: null })).toMatchObject({ ok: false, refusal: { code: 'ASAN_CUSTOMER_ALREADY_EXISTS' } });
    expect(existing.calls).toHaveLength(1);
  });
});
describe('asan document registration', () => {
  const payload = { FactorNumber: 0, CustomerID: 101,
    Description: 'پیش‌فاکتور [CRM:12345678-1234-5234-8234-123456789abc]' };

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

  it('keeps an acknowledged number without claiming registration when readback is absent', async () => {
    const fake = sequencedFetch('501', '[]');
    const result = await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl)
      .registerProforma({ payload, description: 'پیش‌فاکتور' });
    expect(result).toEqual({ ok: true, value: { externalDocumentId: '501',
      documentNumber: '501', registeredAt: null, registrationEvidence: 'ACKNOWLEDGED_ONLY' } });
    expect(fake.calls.map((call) => call.method)).toEqual(['POST', 'GET']);
  });

  it('matches the exact customer, number and operation marker without claiming fiscal confirmation', async () => {
    const fake = sequencedFetch('501', JSON.stringify([{ FactorNumber: 501, CustomerCode: 101,
      Description: payload.Description, FactorDetails: [{ ProductCode: 1001, Count: 2, Price: 1000, StorageID: 0 }] }]));
    const result = await adapter({ baseUrl: 'https://accounting.example/api' }, fake.fetchImpl)
      .registerProforma({ payload, description: 'پیش‌فاکتور' });
    expect(result).toMatchObject({ ok: true, value: { externalDocumentId: '501',
      registrationEvidence: 'IDENTITY_OBSERVED', registeredAt: null } });
    expect(fake.calls[1].url).toContain('PishFactorsNew/LastPishFactors?Count=50');
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
    expect(fake.cancellations()).toBe(1);
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


describe('approved restricted customer financial report requests', () => {
  const scope = { readOnly: true, readAccessScope: 'fixture-authorized' };
  it('reads only the exact OneCustomer identity and keeps balances separate from ordinary profiles', async () => {
    const fixture = { Code: 42, FullName: 'مشتری آزمون', Remain: -100, BookCredit: 0, ChequeCredit: '1000' };
    const fake = fakeFetch({ text: JSON.stringify([fixture]) });
    const instance = adapter(scope, fake.fetchImpl);
    expect(await instance.readCustomerFinance('42')).toMatchObject({ ok: true, value: { customerExternalId: '42',
      remain: { reportedText: '-100' }, bookCredit: { reportedText: '0' }, chequeCredit: { reportedText: '1000' } } });
    expect(fake.calls[0]).toMatchObject({ method: 'GET', url: 'https://accounting.example/api/CustomersNew/OneCustomer?CustomerCode=42' });
    expect(JSON.stringify(parseParty(fixture))).not.toMatch(/"Remain"|"BookCredit"|"ChequeCredit"/);
    expect(await instance.readCustomerFinance('43')).toMatchObject({ ok: false });
  });

  it('sends only the guide-confirmed report body and rejects a foreign customer in the response', async () => {
    const fake = fakeFetch({ text: JSON.stringify([{ FactorNumber: 101, CustomerCode: 42, Description: 'fixture',
      FactorDetails: [{ ProductCode: 10, Count: 1, Price: 100, StorageID: 0 }] }]) });
    const instance = adapter(scope, fake.fetchImpl);
    expect(await instance.listCustomerProformas('42', 5)).toMatchObject({ ok: true, value: [{ customerExternalId: '42' }] });
    expect(fake.calls[0]).toMatchObject({ method: 'POST', url: 'https://accounting.example/api/PishFactorsNew/LastCustomerPishFactors',
      body: '{"Count":5,"CustomerCode":42}' });
    expect(await instance.listCustomerProformas('43', 5)).toMatchObject({ ok: false });
    expect(await instance.listCustomerProformas('9223372036854775807', 5)).toMatchObject({ ok: false });
    expect(fake.calls).toHaveLength(2);
  });

  it('refuses restricted report access without an approved scope', async () => {
    const fake = fakeFetch({ text: '[]' });
    const instance = adapter({}, fake.fetchImpl);
    expect(await instance.readCustomerFinance('42')).toMatchObject({ ok: false });
    expect(await instance.readCustomerLedger('42', '2026-11-01', '2026-11-28')).toMatchObject({ ok: false });
    expect(await instance.listCustomerProformas('42', 5)).toMatchObject({ ok: false });
    expect(fake.calls).toHaveLength(0);
  });
});
