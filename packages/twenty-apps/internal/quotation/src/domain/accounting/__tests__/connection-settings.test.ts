import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONNECTION_SETTINGS,
  checkConnectionWritable,
  connectionSettingsFromRecord,
  normalizeMoneyUnit,
  parseBaseUrl,
  parseConnectionSettings,
} from 'src/domain/accounting/connection-settings';

describe('base url', () => {
  it('accepts an absolute http address and strips a trailing slash', () => {
    expect(parseBaseUrl(' http://127.0.0.1:8080/ ')).toEqual({
      ok: true,
      value: 'http://127.0.0.1:8080',
    });
  });

  it('refuses an empty address', () => {
    expect(parseBaseUrl('')).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_REQUIRED' },
    });
  });

  it('refuses a relative address instead of guessing a host', () => {
    expect(parseBaseUrl('/api')).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_INVALID' },
    });
  });

  it('refuses a non-http scheme', () => {
    expect(parseBaseUrl('ftp://127.0.0.1:8080')).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_INVALID' },
    });
  });

  it('refuses credentials inside the address, which would end up in logs', () => {
    expect(parseBaseUrl('http://user:secret@127.0.0.1:8080')).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_HAS_CREDENTIALS' },
    });
  });

  it('refuses a query string or fragment on a service address', () => {
    expect(parseBaseUrl('http://127.0.0.1:8080/api?x=1')).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_INVALID' },
    });
  });
});

describe('connection settings', () => {
  const valid = {
    baseUrl: 'http://127.0.0.1:8080',
    remoteUserId: '7',
    defaultStorageId: '2',
    moneyUnit: 'RIAL',
    transportApproved: true,
    specialCodes: { discount: true, duty: false, tax: true },
    taxPolicyMappings: {},
  };

  it('parses a complete non-secret configuration', () => {
    expect(parseConnectionSettings(valid)).toEqual({ ok: true, value: valid });
  });

  it('defaults an unknown money unit to UNCONFIRMED rather than picking one', () => {
    const parsed = parseConnectionSettings({ ...valid, moneyUnit: 'USD' });

    expect(parsed.ok && parsed.value.moneyUnit).toBe('UNCONFIRMED');
  });

  it('treats a missing money unit as unconfirmed', () => {
    expect(normalizeMoneyUnit(undefined)).toBe('UNCONFIRMED');
  });

  it('rejects a non-numeric vendor user id', () => {
    expect(parseConnectionSettings({ ...valid, remoteUserId: 'admin' })).toMatchObject(
      {
        ok: false,
        refusal: { code: 'CONNECTION_REMOTE_USER_INVALID' },
      },
    );
  });

  it('rejects a non-numeric warehouse id', () => {
    expect(
      parseConnectionSettings({ ...valid, defaultStorageId: 'main' }),
    ).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_STORAGE_INVALID' },
    });
  });

  it('allows empty optional numeric ids', () => {
    const parsed = parseConnectionSettings({
      ...valid,
      remoteUserId: '',
      defaultStorageId: '',
    });

    expect(parsed).toEqual({ ok: true, value: { ...valid, remoteUserId: '', defaultStorageId: '' } });
  });

  it('keeps an explicit CRM policy to vendor tax code mapping', () => {
    const parsed = parseConnectionSettings({
      ...valid,
      specialCodes: {
        ...valid.specialCodes,
        taxPolicyMappings: { IR_VAT_9: '999141' },
      },
    });

    expect(parsed.ok && parsed.value.taxPolicyMappings).toEqual({
      IR_VAT_9: '999141',
    });
  });

  it('reads a pre-existing record with safe defaults instead of failing', () => {
    expect(connectionSettingsFromRecord({ baseUrl: 'not a url' })).toEqual({
      ...DEFAULT_CONNECTION_SETTINGS,
      baseUrl: 'not a url',
    });
  });

  it('keeps a stored valid address canonical', () => {
    expect(
      connectionSettingsFromRecord({ baseUrl: 'https://accounting.example/' }).baseUrl,
    ).toBe('https://accounting.example');
  });
});

describe('write prerequisites', () => {
  const settings = {
    ...DEFAULT_CONNECTION_SETTINGS,
    baseUrl: 'https://accounting.example',
    moneyUnit: 'RIAL' as const,
  };

  it('blocks every write without an approved transport', () => {
    expect(
      checkConnectionWritable({
        settings: { ...settings, transportApproved: false },
        requiresMoney: false,
      }),
    ).toMatchObject({ ok: false, refusal: { code: 'TRANSPORT_NOT_APPROVED' } });
  });

  it('blocks a money-bearing write while the unit is unconfirmed', () => {
    expect(
      checkConnectionWritable({
        settings: { ...settings, transportApproved: true, moneyUnit: 'UNCONFIRMED' },
        requiresMoney: true,
      }),
    ).toMatchObject({ ok: false, refusal: { code: 'MONEY_UNIT_UNCONFIRMED' } });
  });

  it('allows a money-free write with a confirmed transport and unit', () => {
    expect(
      checkConnectionWritable({
        settings: { ...settings, transportApproved: true },
        requiresMoney: false,
      }).ok,
    ).toBe(true);
  });
});
