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
  baseUrl: 'https://asan.example.ir',
  remoteUserId: '7',
  defaultStorageId: '1',
  moneyUnit: 'RIAL',
  transportApproved: false,
  specialCodes: {},
  healthState: 'UNKNOWN',
  lastHealthCheckAt: null,
  lastHealthMessage: null,
  verificationState: 'LIVE_UNVERIFIED',
  ...overrides,
});

const buildService = ({
  authority,
  row = storedRow(),
  probe,
}: {
  authority: TaxSettingsAuthority | null;
  row?: Record<string, unknown> | null;
  probe?: jest.Mock;
}) => {
  const update = jest.fn();
  const insert = jest.fn();
  const repository = {
    findOne: jest.fn(async () => row),
    update,
    insert,
    find: jest.fn(async () => (row === null ? [] : [row])),
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
  const getRepository = jest.fn(() => repository);
  const runInWorkspaceTransaction = jest.fn(
    async (work: (scope: unknown) => Promise<unknown>) =>
      work({ getRepository: () => repository }),
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
});
