import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationCurrencyAuthorityService } from 'src/modules/quotation/services/quotation-currency-authority.service';

const authContext = {
  type: 'user',
  workspace: { id: 'workspace-1' },
  userWorkspaceId: 'uw-1',
  user: {},
  workspaceMemberId: 'wm-1',
  workspaceMember: {
    id: 'wm-1',
    name: { firstName: 'فرید', lastName: 'رفیعی' },
  },
} as unknown as WorkspaceAuthContext;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'cur-1',
  code: 'IRR',
  name: 'ریال ایران',
  isActive: true,
  isDefault: true,
  accountingCode: '',
  ...overrides,
});

type Repository = {
  find: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

const buildRepository = (): Repository => ({
  find: jest.fn(async () => []),
  insert: jest.fn(async () => ({ identifiers: [{ id: 'cur-new' }] })),
  update: jest.fn(async () => ({ affected: 1 })),
});

const buildService = ({
  repository,
  authority = 'SETTINGS_ROLE',
}: {
  repository: Repository;
  authority?: string | null;
}) => {
  const scope = {
    workspaceId: 'workspace-1',
    executeRawQuery: jest.fn(async () => []),
    getRepository: jest.fn(() => repository),
  };
  const workspaceOrmManager = {
    getRepository: jest.fn(() => repository),
    executeInWorkspaceContext: jest.fn(async (work: () => unknown) => work()),
    runInWorkspaceTransaction: jest.fn(
      async (work: (transactionScope: typeof scope) => unknown) => work(scope),
    ),
  };
  const permissionService = {
    resolveSettingsAuthority: jest.fn(async () => authority),
  };

  return {
    service: new QuotationCurrencyAuthorityService(
      workspaceOrmManager as never,
      permissionService as never,
    ),
    scope,
    repository,
    workspaceOrmManager,
  };
};

describe('QuotationCurrencyAuthorityService', () => {
  it('bootstraps IRR once and leaves an existing catalog untouched', async () => {
    const repository = buildRepository();
    const { service, scope } = buildService({ repository });

    repository.find.mockResolvedValueOnce([]).mockResolvedValue([row()]);

    const first = await service.bootstrap(authContext);

    expect(first).toMatchObject({ kind: 'OK' });
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'IRR',
        isDefault: true,
        accountingCode: '',
      }),
    );
    expect(scope.executeRawQuery).toHaveBeenCalled();

    repository.find.mockResolvedValue([row()]);
    repository.insert.mockClear();

    const second = await service.bootstrap(authContext);

    expect(second).toMatchObject({ kind: 'OK' });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('saves an optional accounting code on an existing currency', async () => {
    const repository = buildRepository();
    repository.find
      .mockResolvedValueOnce([row()])
      .mockResolvedValue([row({ accountingCode: 'GL-IRR' })]);
    const { service } = buildService({ repository });

    const outcome = await service.saveCurrency(
      {
        recordId: 'cur-1',
        name: 'ریال ایران',
        accountingCodeText: ' GL-IRR ',
        isActive: true,
        isDefault: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'cur-1' },
      expect.objectContaining({ accountingCode: 'GL-IRR' }),
    );
  });

  it('refuses creating a non-bootstrap currency in WS1', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([row()]);
    const { service } = buildService({ repository });

    const outcome = await service.saveCurrency(
      {
        recordId: null,
        name: 'دلار',
        accountingCodeText: '',
        isActive: true,
        isDefault: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'QUOTATION_CURRENCY_CREATE_FORBIDDEN',
    });
  });

  it('isolates work through the workspace ORM context', async () => {
    const repository = buildRepository();
    const { service, workspaceOrmManager } = buildService({ repository });
    repository.find.mockResolvedValue([row()]);

    await service.listCurrencies(authContext);

    expect(workspaceOrmManager.getRepository).toHaveBeenCalledWith(
      'quotationCurrency',
      expect.any(Object),
    );
  });
});
