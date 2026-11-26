import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseAccountingNestPanel,
  parseAccountingNestConnections,
  readAccountingNestHealth,
  savedAccountingRecordFromNest,
} from 'src/components/accounting/accounting-nest-response';
import { callAccountingConnectionNestAction } from 'src/components/quotation-api';
import { ADAPTER_DESCRIPTORS } from 'src/domain/accounting/adapter-registry';

const advertised = ADAPTER_DESCRIPTORS.map((adapter) => ({
  id: adapter.id,
  contractVersion: adapter.contractVersion,
  isLive: adapter.isLive,
}));

const serverRecord = (id = 'record-1') => ({
  recordId: id,
  name: 'اتصال حسابداری',
  adapterId: 'mock',
  adapterVersion: '2026-11-1',
  isActive: true,
  isDefault: false,
  settings: {
    baseUrl: 'http://mock.invalid',
    remoteUserId: '',
    defaultStorageId: '',
    moneyUnit: 'RIAL',
    transportApproved: false,
    // The Nest DTO is intentionally nested, unlike the old Functions UI shape.
    specialCodes: {
      discount: true,
      duty: false,
      tax: true,
      taxPolicyMappings: { IR_VAT_9: '64', OLD_POLICY: '99' },
      specialItemCodes: { discount: '999123', tax: '999141' },
    },
    financial: {
      baseCurrency: 'IRR',
      currencyMappings: { IRR: 'RIAL', OLD_CURRENCY: 'OLD' },
      conversionRate: '',
      mockProfile: 'CODED',
    },
  },
  capabilities: { taxHandling: 'TAX_CODE' },
  healthState: 'UNKNOWN',
  lastHealthCheckAt: null,
  lastHealthMessage: null,
  verificationState: 'MOCK',
});

describe('Nest accounting connection response bridge', () => {
  it('keeps the server id, nested historical maps and server-confirmed adapters', () => {
    const panel = parseAccountingNestPanel({
      success: true,
      canManage: false,
      supportedAdapters: advertised,
      connections: [serverRecord()],
    });

    expect(panel.canManage).toBe(false);
    expect(panel.adapters.map((adapter) => adapter.id).sort()).toEqual(['asan', 'mock']);
    expect(panel.metadataVerified).toBe(false);
    expect(panel.flags.outboundEnabled).toBe(false);
    expect(panel.connections[0].id).toBe('record-1');
    expect(panel.connections[0].settings.taxPolicyMappings).toEqual({
      IR_VAT_9: '64',
      OLD_POLICY: '99',
    });
    expect(panel.connections[0].settings.specialItemCodes).toEqual({
      discount: '999123',
      tax: '999141',
    });
    expect(panel.connections[0].settings.financial?.currencyMappings).toEqual({
      IRR: 'RIAL',
      OLD_CURRENCY: 'OLD',
    });
  });

  it('never trusts an unsupported or changed server adapter descriptor', () => {
    const panel = parseAccountingNestPanel({
      success: true,
      canManage: true,
      connections: [serverRecord()],
      supportedAdapters: [
        { id: 'mock', contractVersion: 'changed', isLive: false },
        { id: 'unknown', contractVersion: '2026-11-1', isLive: false },
      ],
    });

    expect(panel.adapters).toEqual([]);
    expect(panel.connections[0].adapterId).toBe('mock');
  });

  it('rejects a missing server adapter list, bad records and missing authority', () => {
    expect(() => parseAccountingNestPanel({
      success: true,
      canManage: true,
      connections: [],
    })).toThrow('ACCOUNTING_ADAPTER_CONTRACT_UNAVAILABLE');
    expect(() => parseAccountingNestPanel({
      success: true,
      connections: [],
      supportedAdapters: advertised,
    })).toThrow('ACCOUNTING_AUTHORITY_RESPONSE_INVALID');
    expect(() => parseAccountingNestConnections([{ recordId: 'a' }])).toThrow(
      'ACCOUNTING_CONNECTION_RECORD_INVALID',
    );
  });

  it('uses authoritative affectedRecordId rather than duplicate names or row order', () => {
    const saved = savedAccountingRecordFromNest({
      success: true,
      affectedRecordId: 'record-2',
      connections: [serverRecord('record-1'), serverRecord('record-2')],
    }, null);

    expect(saved.id).toBe('record-2');
    expect(() => savedAccountingRecordFromNest({
      success: true,
      connections: [serverRecord('record-1')],
    }, null)).toThrow('ACCOUNTING_SAVED_ID_MISSING_OR_CHANGED');
    expect(() => savedAccountingRecordFromNest({
      success: true,
      affectedRecordId: 'record-2',
      connections: [serverRecord('record-2')],
    }, 'record-1')).toThrow('ACCOUNTING_SAVED_ID_MISSING_OR_CHANGED');
  });

  it('reads actual nested Nest probe health and rejects malformed success', () => {
    expect(readAccountingNestHealth({
      success: true,
      health: { healthState: 'OK', message: 'آزمایش انجام شد', detail: 'Mock' },
    })).toEqual({
      healthState: 'OK',
      message: 'آزمایش انجام شد',
      detail: 'Mock',
    });
    expect(() => readAccountingNestHealth({ success: true })).toThrow(
      'ACCOUNTING_HEALTH_RESPONSE_INVALID',
    );
  });
});

describe('Nest action transport (no Functions /s fallback)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('maps all six actions to the existing authorized endpoint', async () => {
    vi.stubEnv('TWENTY_API_URL', 'http://localhost:3002');
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', 'test-token');

    const requestBodies: string[] = [];

    vi.stubGlobal('fetch', vi.fn(async (_url: string, request: RequestInit) => {
      requestBodies.push(String(request.body));
      return {
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
      };
    }));

    const actions = {
      list: 'accounting-connection-list',
      save: 'accounting-connection-save',
      test: 'accounting-connection-test',
      'set-default': 'accounting-connection-set-default',
      deactivate: 'accounting-connection-deactivate',
      reactivate: 'accounting-connection-reactivate',
    };

    for (const [action, expected] of Object.entries(actions)) {
      await callAccountingConnectionNestAction({ action });
      expect(JSON.parse(requestBodies.at(-1) ?? '{}').action).toBe(expected);
    }

    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[0]).toBe('http://localhost:3002/rest/quotation/actions');
    }
  });

  it('rejects an unlisted action without making a network request', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);

    const response = await callAccountingConnectionNestAction({
      action: 'invented-admin-operation',
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
});
