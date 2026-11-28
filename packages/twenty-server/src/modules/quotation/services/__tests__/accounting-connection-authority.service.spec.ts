import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { AccountingConnectionAuthorityService } from 'src/modules/quotation/services/accounting-connection-authority.service';
import { type AccountingDestinationProbeService } from 'src/modules/quotation/services/accounting-destination-probe.service';
import { type QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { type TaxSettingsAuthority } from 'src/modules/quotation/types/tax-policy.type';

const userAuthContext = {
  type: 'user',
  workspace: { id: 'workspace-1' },
  userWorkspaceId: 'uw-1',
  user: { id: 'user-1' },
  workspaceMemberId: 'wm-1',
  workspaceMember: { id: 'wm-1', name: 'مدیر' },
} as unknown as WorkspaceAuthContext;

const storedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'connection-1',
  name: 'آسان',
  adapterId: 'asan',
  adapterVersion: '2026-11-1',
  capabilities: null,
  isActive: true,
  isDefault: false,
  baseUrl: 'https://asan.example.ir',
  remoteUserId: '7',
  defaultStorageId: '1',
  moneyUnit: 'RIAL',
  transportApproved: false,
  specialCodes: {},
  financialSettings: {},
  healthState: 'UNKNOWN',
  lastHealthCheckAt: null,
  lastHealthMessage: null,
  verificationState: 'LIVE_UNVERIFIED',
  ...overrides,
});

const buildService = ({
  authority,
  row = storedRow(),
  rows,
  probe,
  history = null,
}: {
  authority: TaxSettingsAuthority | null;
  row?: Record<string, unknown> | null;
  rows?: Record<string, unknown>[];
  probe?: jest.Mock;
  history?: { id: string } | null;
}) => {
  const update = jest.fn();
  const insert = jest.fn();
  const listed = rows ?? (row === null ? [] : [row]);
  const repository = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
      listed.find((entry) => entry.id === where.id) ?? null,
    ),
    update,
    insert,
    find: jest.fn(async () => listed),
  };
  const probeMock =
    probe ??
    jest.fn(async () => ({
      healthState: 'OK' as const,
      code: 'REACHABLE' as const,
      latencyMs: 4,
      checkedAt: '2026-11-22T00:00:00.000Z',
      detail: 'ok',
    }));
  const executeInWorkspaceContext = jest.fn(async (work: () => Promise<unknown>) =>
    work(),
  );
  const executeRawQuery = jest.fn(async () => undefined);
  const getRepository = jest.fn(() => repository);
  const runInWorkspaceTransaction = jest.fn(
    async (work: (scope: unknown) => Promise<unknown>) =>
      work({
        getRepository: (name: string) => name === 'accountingConnection'
          ? repository : { findOne: jest.fn(async () => history) },
        executeRawQuery,
        workspaceId: 'workspace-1',
      }),
  );

  const service = new AccountingConnectionAuthorityService(
    {
      executeInWorkspaceContext,
      getRepository,
      runInWorkspaceTransaction,
    } as unknown as WorkspaceOrmManager,
    { resolveSettingsAuthority: async () => authority } as unknown as QuotationPermissionService,
    { probe: probeMock } as unknown as AccountingDestinationProbeService,
  );

  return {
    service,
    update,
    insert,
    repository,
    probeMock,
    getRepository,
    runInWorkspaceTransaction,
    executeInWorkspaceContext,
    executeRawQuery,
  };
};

describe('AccountingConnectionAuthorityService', () => {
  it('refuses a save from a caller without settings authority, with zero repository access', async () => {
    const { service, getRepository, runInWorkspaceTransaction } = buildService({
      authority: null,
    });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://asan.example.ir' },
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
    });
    expect(getRepository).not.toHaveBeenCalled();
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('refuses a connection test from a caller without settings authority, without probing', async () => {
    const { service, probeMock, runInWorkspaceTransaction } = buildService({
      authority: null,
    });

    const outcome = await service.testConnection('connection-1', userAuthContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
    });
    expect(probeMock).not.toHaveBeenCalled();
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('derives verification from the stored adapter contract, never from the caller', async () => {
    for (const [adapterId, expected] of [
      ['asan', 'LIVE_UNVERIFIED'],
      ['mock', 'MOCK'],
    ] as const) {
      const { service, update } = buildService({
        authority: 'SETTINGS_ROLE',
        row: storedRow({ adapterId }),
      });

      const outcome = await service.testConnection(
        'connection-1',
        userAuthContext,
      );

      expect(outcome).toMatchObject({ kind: 'OK' });
      expect(update).toHaveBeenCalledWith(
        { id: 'connection-1' },
        expect.objectContaining({ verificationState: expected }),
      );
    }
  });

  it('refuses to rebind a connection that already owns mappings or history', async () => {
    const { service, update } = buildService({ authority: 'SETTINGS_ROLE', history: { id: 'link' } });
    const outcome = await service.saveConnection({
      recordId: 'connection-1', name: 'آسان', adapterId: 'asan',
      settings: { baseUrl: 'https://different.example.ir', moneyUnit: 'RIAL' },
    }, userAuthContext);
    expect(outcome).toMatchObject({ kind: 'REFUSED', code: 'ACCOUNTING_DATASET_REBIND_REQUIRED' });
    expect(update).not.toHaveBeenCalled();
  });

  it('does not store health from an endpoint changed during the probe', async () => {
    const rows = [storedRow()];
    const probe = jest.fn(async () => {
      rows[0] = { ...rows[0], baseUrl: 'https://different.example.ir' };
      return { healthState: 'OK', code: 'REACHABLE', latencyMs: 1,
        checkedAt: '2026-11-22T00:00:00.000Z', detail: 'ok' };
    });
    const { service, update } = buildService({ authority: 'SETTINGS_ROLE', rows, probe });
    expect(await service.testConnection('connection-1', userAuthContext))
      .toMatchObject({ kind: 'REFUSED', code: 'ACCOUNTING_CONNECTION_CHANGED' });
    expect(update).not.toHaveBeenCalled();
  });

  it('stores the adapter contract capabilities, ignoring a forged capabilities payload', async () => {
    const { service, insert } = buildService({ authority: 'SETTINGS_ROLE' });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://asan.example.ir' },
        // A caller trying to change what the destination can do.
        capabilities: { documents: { createProforma: false } },
      } as never,
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    const stored = insert.mock.calls[0][0] as {
      capabilities: { documents: { createProforma: boolean } };
    };

    expect(stored.capabilities.documents.createProforma).toBe(true);
  });

  it('never lets the probe result mint LIVE_VERIFIED for a live adapter', async () => {
    const { service, update } = buildService({ authority: 'SETTINGS_ROLE' });

    const outcome = await service.testConnection('connection-1', userAuthContext);

    expect(outcome).toMatchObject({
      kind: 'OK',
      health: { healthState: 'OK' },
    });
    expect(update).toHaveBeenCalledWith(
      { id: 'connection-1' },
      expect.objectContaining({
        healthState: 'OK',
        verificationState: 'LIVE_UNVERIFIED',
      }),
    );
  });

  it('stores a failed probe as FAILED rather than trusting the caller', async () => {
    const probe = jest.fn(async () => ({
      healthState: 'FAILED' as const,
      code: 'TRANSPORT_ERROR' as const,
      latencyMs: 0,
      checkedAt: '2026-11-22T00:00:00.000Z',
      detail: 'ارتباط برقرار نشد',
    }));
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      probe,
    });

    await service.testConnection('connection-1', userAuthContext);

    expect(update).toHaveBeenCalledWith(
      { id: 'connection-1' },
      expect.objectContaining({ healthState: 'FAILED' }),
    );
  });

  it('reads a stored timestamp and legacy nulls without crashing', async () => {
    const checkedAt = new Date('2026-11-22T00:00:00.000Z');
    const service = new AccountingConnectionAuthorityService(
      {
        executeInWorkspaceContext: async (work: () => Promise<unknown>) => work(),
        getRepository: () => ({
          find: async () => [
            {
              id: 'connection-1',
              name: 'اتصال',
              adapterId: 'mock',
              baseUrl: 'https://mock.invalid',
              moneyUnit: 'UNCONFIRMED',
              healthState: 'OK',
              lastHealthCheckAt: checkedAt,
              lastHealthMessage: null,
              verificationState: 'MOCK',
            },
          ],
        }),
        runInWorkspaceTransaction: jest.fn(),
      } as unknown as WorkspaceOrmManager,
      {
        resolveSettingsAuthority: async () => null,
      } as unknown as QuotationPermissionService,
      { probe: jest.fn() } as unknown as AccountingDestinationProbeService,
    );

    const outcome = await service.listConnections(userAuthContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    if (outcome.kind === 'OK') {
      expect(outcome.connections[0].lastHealthCheckAt).toBe(checkedAt.toISOString());
    }
  });

  it('refuses an adapter that has no operational implementation', async () => {
    const { service, runInWorkspaceTransaction } = buildService({
      authority: 'SETTINGS_ROLE',
    });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'سپیدار',
        adapterId: 'sepidar',
        settings: { baseUrl: 'https://sepidar.example.ir' },
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'REFUSED', code: 'ADAPTER_UNKNOWN' });
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('refuses an unsafe destination before touching the database', async () => {
    const { service, runInWorkspaceTransaction } = buildService({
      authority: 'SETTINGS_ROLE',
    });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://admin:secret@asan.example.ir' },
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'CONNECTION_BASE_URL_HAS_CREDENTIALS',
    });
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('does not turn transportApproved into an internal-network permission', async () => {
    const { service, runInWorkspaceTransaction } = buildService({
      authority: 'SETTINGS_ROLE',
    });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'آسان داخلی',
        adapterId: 'asan',
        settings: {
          baseUrl: 'http://192.168.1.10:8080',
          transportApproved: true,
        },
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'CONNECTION_DESTINATION_NOT_ALLOWLISTED',
    });
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('refuses set-default without settings authority', async () => {
    const { service, executeRawQuery, update } = buildService({
      authority: null,
      rows: [storedRow({ id: 'a' }), storedRow({ id: 'b' })],
    });

    const outcome = await service.setDefaultConnection('a', userAuthContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
    });
    expect(executeRawQuery).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('sets A as the only workspace default then moves the default to B', async () => {
    const rows = [
      storedRow({ id: 'a', name: 'A', isDefault: false }),
      storedRow({ id: 'b', name: 'B', isDefault: false }),
    ];
    const { service, update, executeRawQuery } = buildService({
      authority: 'SETTINGS_ROLE',
      rows,
    });

    const first = await service.setDefaultConnection('a', userAuthContext);

    expect(first).toMatchObject({ kind: 'OK' });
    expect(executeRawQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['quotation-accounting-connection:workspace-1'],
    );
    expect(update).toHaveBeenCalledWith(
      { id: 'a' },
      expect.objectContaining({ isDefault: true }),
    );

    rows[0] = { ...rows[0], isDefault: true };
    update.mockClear();

    const second = await service.setDefaultConnection('b', userAuthContext);

    expect(second).toMatchObject({ kind: 'OK' });
    expect(update).toHaveBeenCalledWith(
      { id: 'a' },
      expect.objectContaining({ isDefault: false }),
    );
    expect(update).toHaveBeenCalledWith(
      { id: 'b' },
      expect.objectContaining({ isDefault: true }),
    );
  });

  it('refuses to promote an inactive connection to workspace default', async () => {
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [storedRow({ id: 'inactive', isActive: false })],
    });

    const outcome = await service.setDefaultConnection(
      'inactive',
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_CONNECTION_DEFAULT_MUST_BE_ACTIVE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a connection id that is not in this workspace', async () => {
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [storedRow({ id: 'local-only' })],
    });

    const outcome = await service.setDefaultConnection(
      'foreign-workspace-row',
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_CONNECTION_NOT_FOUND',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('inserts new connections with isDefault false so old data is not auto-promoted', async () => {
    const { service, insert } = buildService({ authority: 'SETTINGS_ROLE' });

    await service.saveConnection(
      {
        recordId: null,
        name: 'آسان',
        adapterId: 'asan',
        settings: { baseUrl: 'https://asan.example.ir' },
      },
      userAuthContext,
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: false, isActive: true }),
    );
  });

  it('returns an exact immutable affected id from an authorized create transaction', async () => {
    const { service, insert } = buildService({ authority: 'SETTINGS_ROLE' });

    const outcome = await service.saveConnection(
      {
        recordId: null,
        name: 'اتصال جدید',
        adapterId: 'mock',
        settings: { baseUrl: 'http://mock.invalid' },
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });

    if (outcome.kind !== 'OK') {
      throw new Error('Expected an authorized save');
    }

    const inserted = insert.mock.calls[0][0] as { id: string; isDefault: boolean };

    expect(inserted.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(outcome.affectedRecordId).toBe(inserted.id);
    expect(inserted.isDefault).toBe(false);
  });

  it('refuses deactivate without settings authority', async () => {
    const { service, update, executeRawQuery } = buildService({
      authority: null,
      rows: [storedRow({ id: 'a' })],
    });

    const outcome = await service.deactivateConnection('a', userAuthContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_SETTINGS_FORBIDDEN',
    });
    expect(executeRawQuery).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('soft-retires an ordinary active connection without touching other rows', async () => {
    const { service, update, executeRawQuery } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [
        storedRow({ id: 'a', isDefault: false }),
        storedRow({ id: 'b', isDefault: true }),
      ],
    });

    const outcome = await service.deactivateConnection('a', userAuthContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(executeRawQuery).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      { id: 'a' },
      expect.objectContaining({ isActive: false }),
    );
    expect(update).not.toHaveBeenCalledWith(
      { id: 'b' },
      expect.anything(),
    );
  });

  it('clears isDefault when retiring the workspace default and does not promote another', async () => {
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [
        storedRow({ id: 'default', isDefault: true }),
        storedRow({ id: 'other', isDefault: false }),
      ],
    });

    const outcome = await service.deactivateConnection(
      'default',
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(update).toHaveBeenCalledWith(
      { id: 'default' },
      expect.objectContaining({ isActive: false, isDefault: false }),
    );
    expect(update).not.toHaveBeenCalledWith(
      { id: 'other' },
      expect.objectContaining({ isDefault: true }),
    );
  });

  it('refuses a foreign connection id on deactivate (workspace isolation)', async () => {
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [storedRow({ id: 'local-only' })],
    });

    const outcome = await service.deactivateConnection(
      'foreign-row',
      userAuthContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_CONNECTION_NOT_FOUND',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('reactivates without restoring workspace default', async () => {
    const { service, update } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [
        storedRow({ id: 'retired', isActive: false, isDefault: false }),
        storedRow({ id: 'other', isDefault: true }),
      ],
    });

    const outcome = await service.reactivateConnection(
      'retired',
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(update).toHaveBeenCalledWith(
      { id: 'retired' },
      expect.objectContaining({ isActive: true, isDefault: false }),
    );
    expect(update).not.toHaveBeenCalledWith(
      { id: 'retired' },
      expect.objectContaining({ isDefault: true }),
    );
  });

  it('serializes deactivate under the same advisory lock as set-default', async () => {
    const { service, executeRawQuery } = buildService({
      authority: 'SETTINGS_ROLE',
      rows: [storedRow({ id: 'a', isDefault: true })],
    });

    await service.deactivateConnection('a', userAuthContext);

    expect(executeRawQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['quotation-accounting-connection:workspace-1'],
    );
  });
});
