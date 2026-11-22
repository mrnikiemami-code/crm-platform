import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { AccountingConnectionAuthorityService } from 'src/modules/quotation/services/accounting-connection-authority.service';
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

const buildService = (authority: TaxSettingsAuthority | null) => {
  const executeInWorkspaceContext = jest.fn(async (work: () => Promise<unknown>) =>
    work(),
  );
  const getRepository = jest.fn();
  const runInWorkspaceTransaction = jest.fn();

  const service = new AccountingConnectionAuthorityService(
    { executeInWorkspaceContext, getRepository, runInWorkspaceTransaction } as unknown as WorkspaceOrmManager,
    { resolveSettingsAuthority: async () => authority } as unknown as QuotationPermissionService,
  );

  return { service, getRepository, runInWorkspaceTransaction, executeInWorkspaceContext };
};

describe('AccountingConnectionAuthorityService', () => {
  it('refuses a save from a caller without settings authority, with zero repository access', async () => {
    const { service, getRepository, runInWorkspaceTransaction } = buildService(null);

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

  it('refuses a health write from a caller without settings authority', async () => {
    const { service, runInWorkspaceTransaction } = buildService(null);

    const outcome = await service.persistHealth(
      {
        recordId: 'connection-1',
        healthState: 'OK',
        message: 'ok',
        checkedAt: new Date().toISOString(),
      },
      userAuthContext,
    );

    expect(outcome).toMatchObject({ kind: 'REFUSED' });
    expect(runInWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it('derives verification from the stored adapter, never from the caller', async () => {
    const buildWithAdapter = (adapterId: string) => {
      const update = jest.fn();
      const scope = {
        getRepository: () => ({
          findOne: async () => ({ id: 'connection-1', adapterId }),
          update,
          find: async () => [],
        }),
      };

      const service = new AccountingConnectionAuthorityService(
        {
          executeInWorkspaceContext: async (work: () => Promise<unknown>) =>
            work(),
          getRepository: () => ({ find: async () => [] }),
          runInWorkspaceTransaction: async (work: (value: unknown) => Promise<unknown>) =>
            work(scope),
        } as unknown as WorkspaceOrmManager,
        {
          resolveSettingsAuthority: async () => 'SETTINGS_ROLE',
        } as unknown as QuotationPermissionService,
      );

      return { service, update };
    };

    for (const [adapterId, expected] of [
      ['asan', 'LIVE_UNVERIFIED'],
      ['mock', 'MOCK'],
    ] as const) {
      const { service, update } = buildWithAdapter(adapterId);
      const outcome = await service.persistHealth(
        {
          recordId: 'connection-1',
          healthState: 'OK',
          message: 'ok',
          checkedAt: new Date().toISOString(),
        },
        userAuthContext,
      );

      expect(outcome).toMatchObject({ kind: 'OK' });
      expect(update).toHaveBeenCalledWith(
        { id: 'connection-1' },
        expect.objectContaining({ verificationState: expected }),
      );
    }
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
    );

    const outcome = await service.listConnections(userAuthContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    if (outcome.kind === 'OK') {
      expect(outcome.connections[0].lastHealthCheckAt).toBe(checkedAt.toISOString());
    }
  });

  it('refuses an adapter that has no operational implementation', async () => {
    const { service, runInWorkspaceTransaction } = buildService('SETTINGS_ROLE');

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
    const { service, runInWorkspaceTransaction } = buildService('SETTINGS_ROLE');

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
});
