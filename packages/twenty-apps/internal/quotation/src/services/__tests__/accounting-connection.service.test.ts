import { describe, expect, it, vi } from 'vitest';

import {
  buildAdapter,
  describeSecretStatus,
  loadConnections,
  parseConnectionRecord,
  persistHealth,
  readAdapterSecrets,
  resolveConnection,
  saveConnection,
  testConnection,
  type AccountingConnectionRecord,
} from 'src/services/accounting-connection.service';

const node = (overrides: Record<string, unknown> = {}) => ({
  id: 'conn-1',
  name: 'آسان کارخانه',
  adapterId: 'asan',
  adapterVersion: '2026-11-1',
  isActive: true,
  baseUrl: 'https://accounting.example',
  remoteUserId: '7',
  defaultStorageId: '2',
  moneyUnit: 'RIAL',
  transportApproved: true,
  specialCodes: { discount: true, duty: false, tax: true },
  healthState: 'OK',
  lastHealthCheckAt: '2026-11-21T08:00:00.000Z',
  lastHealthMessage: 'پاسخ داد',
  verificationState: 'LIVE_UNVERIFIED',
  ...overrides,
});

const edges = (...rows: Record<string, unknown>[]) => ({
  accountingConnections: { edges: rows.map((row) => ({ node: row })) },
});

describe('connection record parsing', () => {
  it('reads a full record, keeping unconfirmed defaults for absent fields', () => {
    expect(parseConnectionRecord(node())).toEqual({
      id: 'conn-1',
      name: 'آسان کارخانه',
      adapterId: 'asan',
      adapterVersion: '2026-11-1',
      isActive: true,
      settings: {
        baseUrl: 'https://accounting.example',
        remoteUserId: '7',
        defaultStorageId: '2',
        moneyUnit: 'RIAL',
        transportApproved: true,
        specialCodes: { discount: true, duty: false, tax: true },
        taxPolicyMappings: {},
      },
      capabilities: null,
      healthState: 'OK',
      lastHealthCheckAt: '2026-11-21T08:00:00.000Z',
      lastHealthMessage: 'پاسخ داد',
      verificationState: 'LIVE_UNVERIFIED',
    });
  });

  it('drops a node without an id rather than inventing an empty connection', () => {
    expect(parseConnectionRecord(node({ id: '' }))).toBeNull();
  });

  it('reports an unknown health state as UNKNOWN', () => {
    expect(parseConnectionRecord(node({ healthState: '' }))?.healthState).toBe('UNKNOWN');
  });
});

describe('connection listing and resolution', () => {
  it('loads all connections through the record API', async () => {
    const execute = vi.fn(async () => edges(node(), node({ id: 'conn-2', isActive: false })));

    const connections = await loadConnections({ execute });

    expect(connections.map((connection) => connection.id)).toEqual(['conn-1', 'conn-2']);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('resolves the active connection when no id is named', async () => {
    const execute = vi.fn(async () =>
      edges(node({ id: 'conn-1', isActive: false }), node({ id: 'conn-2', isActive: true })),
    );

    const resolved = await resolveConnection({}, { execute });

    expect(resolved.ok && resolved.value.id).toBe('conn-2');
  });

  it('refuses when nothing is configured instead of returning an empty object', async () => {
    const resolved = await resolveConnection({}, { execute: async () => edges() });

    expect(resolved).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_NOT_FOUND' },
    });
  });

  it('refuses a named connection that does not exist', async () => {
    const resolved = await resolveConnection(
      { connectionId: 'missing' },
      { execute: async () => edges(node()) },
    );

    expect(resolved).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_NOT_FOUND' },
    });
  });
});

describe('saving a connection', () => {
  const validSettings = {
    baseUrl: 'https://accounting.example',
    remoteUserId: '7',
    defaultStorageId: '',
    moneyUnit: 'RIAL',
    transportApproved: true,
    specialCodes: { discount: false, duty: false, tax: false },
  };

  it('refuses a connection without a name', async () => {
    const saved = await saveConnection({
      name: ' ',
      adapterId: 'asan',
      settings: validSettings,
    });

    expect(saved).toMatchObject({ ok: false, refusal: { code: 'INVALID_INPUT' } });
  });

  it('refuses an adapter that is not implemented', async () => {
    const saved = await saveConnection({
      name: 'سپیدار',
      adapterId: 'sepidar',
      settings: validSettings,
    });

    expect(saved).toMatchObject({ ok: false, refusal: { code: 'ADAPTER_UNKNOWN' } });
  });

  it('refuses invalid settings before writing anything', async () => {
    const execute = vi.fn();

    const saved = await saveConnection(
      {
        name: 'آسان',
        adapterId: 'asan',
        settings: { ...validSettings, baseUrl: 'http://user:pass@host' },
      },
      { execute },
    );

    expect(saved).toMatchObject({
      ok: false,
      refusal: { code: 'CONNECTION_BASE_URL_HAS_CREDENTIALS' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('creates a connection and never writes a credential into the record', async () => {
    const execute = vi.fn(async (query: string) => {
      expect(query).toContain('createAccountingConnection');
      expect(query).not.toMatch(/token|password|secret/i);
      expect(query).toContain('LIVE_UNVERIFIED');

      return { createAccountingConnection: node({ verificationState: 'LIVE_UNVERIFIED' }) };
    });

    const saved = await saveConnection(
      { name: 'آسان', adapterId: 'asan', settings: validSettings },
      { execute },
    );

    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.value.adapter.id).toBe('asan');
  });

  it('resets health to UNKNOWN when an existing connection is updated', async () => {
    const execute = vi.fn(async (query: string) => {
      expect(query).toContain('updateAccountingConnection');
      expect(query).toContain('healthState: "UNKNOWN"');

      return { updateAccountingConnection: node({ healthState: 'UNKNOWN' }) };
    });

    const saved = await saveConnection(
      { id: 'conn-1', name: 'آسان', adapterId: 'asan', settings: validSettings },
      { execute },
    );

    expect(saved).toMatchObject({
      ok: true,
      value: { connection: { healthState: 'UNKNOWN' } },
    });
  });

  it('marks a mock connection as mock, never as verified live', async () => {
    const execute = vi.fn(async () => ({
      createAccountingConnection: node({
        adapterId: 'mock',
        verificationState: 'MOCK',
      }),
    }));

    const saved = await saveConnection(
      {
        name: 'آزمایشی',
        adapterId: 'mock',
        settings: { ...validSettings, baseUrl: 'https://mock.example' },
      },
      { execute },
    );

    expect(saved).toMatchObject({
      ok: true,
      value: { connection: { verificationState: 'MOCK' } },
    });
  });
});

describe('credentials', () => {
  it('reads the tunnel token and transport approval from the environment only', () => {
    const secrets = readAdapterSecrets({
      ASAN_TUNNEL_TOKEN: 'secret',
      ASAN_TRANSPORT_APPROVED: 'true',
    });

    expect(secrets).toEqual({ tunnelToken: 'secret', allowInsecureTransport: true });
    expect(describeSecretStatus(secrets)).toEqual({
      tunnelTokenConfigured: true,
      insecureWritesApproved: true,
    });
  });

  it('treats an empty token as not configured', () => {
    const secrets = readAdapterSecrets({ ASAN_TUNNEL_TOKEN: '', ASAN_TRANSPORT_APPROVED: 'false' });

    expect(secrets.tunnelToken).toBeUndefined();
    expect(describeSecretStatus(secrets)).toEqual({
      tunnelTokenConfigured: false,
      insecureWritesApproved: false,
    });
  });

  it('refuses to build an Asan adapter with no service address', () => {
    const record: AccountingConnectionRecord = {
      id: 'conn-1',
      name: 'آسان',
      adapterId: 'asan',
      adapterVersion: null,
      isActive: true,
      settings: {
        baseUrl: '',
        remoteUserId: '',
        defaultStorageId: '',
        moneyUnit: 'UNCONFIRMED',
        transportApproved: false,
        specialCodes: { discount: false, duty: false, tax: false },
        taxPolicyMappings: {},
      },
      capabilities: null,
      healthState: 'UNKNOWN',
      lastHealthCheckAt: null,
      lastHealthMessage: null,
      verificationState: 'LIVE_UNVERIFIED',
    };

    expect(buildAdapter(record, { allowInsecureTransport: false })).toMatchObject({
      ok: false,
      refusal: { code: 'ADAPTER_NOT_CONFIGURED' },
    });
  });
});

describe('testing the connection', () => {
  const mockRecord: AccountingConnectionRecord = {
    id: 'conn-1',
    name: 'آزمایشی',
    adapterId: 'mock',
    adapterVersion: '2026-11-1',
    isActive: true,
    settings: {
      baseUrl: 'https://mock.example',
      remoteUserId: '',
      defaultStorageId: '',
      moneyUnit: 'UNCONFIRMED',
      transportApproved: false,
      specialCodes: { discount: false, duty: false, tax: false },
      taxPolicyMappings: {},
    },
    capabilities: null,
    healthState: 'UNKNOWN',
    lastHealthCheckAt: null,
    lastHealthMessage: null,
    verificationState: 'MOCK',
  };

  it('reports a mock probe as mock, not as a verified live connection', async () => {
    const result = await testConnection(
      mockRecord,
      { allowInsecureTransport: false },
      { now: () => new Date('2026-11-21T08:00:00.000Z') },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        healthState: 'OK',
        verificationState: 'MOCK',
        checkedAt: expect.any(String),
      },
    });
  });

  it('persists health and verification on the record', async () => {
    const execute = vi.fn(async (query: string) => {
      expect(query).toContain('updateAccountingConnection');
      expect(query).toContain('"OK"');
      expect(query).toContain('LIVE_VERIFIED');

      return { updateAccountingConnection: node() };
    });

    await persistHealth(
      'conn-1',
      {
        healthState: 'OK',
        message: 'پاسخ داد',
        verificationState: 'LIVE_VERIFIED',
        latencyMs: 12,
        detail: 'ok',
        checkedAt: '2026-11-21T08:00:00.000Z',
      },
      { execute },
    );

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
