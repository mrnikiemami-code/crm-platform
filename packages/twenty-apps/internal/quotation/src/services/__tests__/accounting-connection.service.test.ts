import { describe, expect, it, vi } from 'vitest';

import { callAccountingSettingsAction } from 'src/data/accounting-settings-api';
import {
  buildAdapter,
  describeSecretStatus,
  loadConnections,
  loadConnectionsThroughServer,
  parseConnectionRecord,
  readAdapterSecrets,
  resolveConnection,
  type AccountingConnectionRecord,
} from 'src/services/accounting-connection.service';
import { DEFAULT_FINANCIAL_SETTINGS } from 'src/domain/accounting/financial-contract';

vi.mock('src/data/accounting-settings-api', () => ({
  callAccountingSettingsAction: vi.fn(),
}));

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
        financial: DEFAULT_FINANCIAL_SETTINGS,
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

  // A regression guard, not a shape preference: the server hands the settings back in a
  // nested node, and reading the envelope instead made a saved unit, address and mock
  // profile come back as defaults, so the page looked like nothing had persisted.
  it('reads the saved settings from the nested node the server returns', async () => {
    vi.mocked(callAccountingSettingsAction).mockResolvedValueOnce({
      kind: 'OK',
      data: {
        connections: [
          {
            recordId: 'conn-server',
            name: 'UAT کدی',
            adapterId: 'mock',
            isActive: true,
            settings: {
              baseUrl: 'mock://local',
              remoteUserId: '',
              defaultStorageId: '',
              moneyUnit: 'TOMAN',
              transportApproved: false,
              specialCodes: {
                discount: false,
                duty: false,
                tax: false,
                taxPolicyMappings: { IR_VAT_9: 'TAX-01' },
              },
              financial: {
                baseCurrency: 'IRR',
                currencyMappings: { IRR: '1' },
                conversionRate: '',
                mockProfile: 'CODED',
              },
            },
            healthState: 'UNKNOWN',
            verificationState: 'MOCK',
          },
        ],
      },
    });

    const loaded = await loadConnectionsThroughServer({
      authorizationHeader: 'Bearer caller',
    });

    expect(loaded.ok).toBe(true);

    if (loaded.ok) {
      expect(loaded.value[0].settings).toMatchObject({
        baseUrl: 'mock://local',
        moneyUnit: 'TOMAN',
        taxPolicyMappings: { IR_VAT_9: 'TAX-01' },
        financial: {
          baseCurrency: 'IRR',
          currencyMappings: { IRR: '1' },
          mockProfile: 'CODED',
        },
      });
    }
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
    const secrets = readAdapterSecrets({
      ASAN_TUNNEL_TOKEN: '',
      ASAN_TRANSPORT_APPROVED: 'false',
    });

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
