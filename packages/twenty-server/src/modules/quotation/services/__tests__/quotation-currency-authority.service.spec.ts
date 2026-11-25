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
  quotations,
}: {
  repository: Repository;
  authority?: string | null;
  quotations?: Repository;
}) => {
  const quotationRepository = quotations ?? buildRepository();
  const scope = {
    workspaceId: 'workspace-1',
    executeRawQuery: jest.fn(async () => []),
    getRepository: jest.fn((objectName: string) =>
      objectName === 'quotation' ? quotationRepository : repository,
    ),
  };
  const workspaceOrmManager = {
    getRepository: jest.fn((objectName: string) =>
      objectName === 'quotation' ? quotationRepository : repository,
    ),
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
  it('bootstraps IRR once and leaves an existing IRR catalog untouched', async () => {
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
    repository.update.mockClear();

    const second = await service.bootstrap(authContext);

    expect(second).toMatchObject({ kind: 'OK' });
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('bootstraps IRR when the catalog is non-empty but IRR is missing', async () => {
    const usd = row({
      id: 'cur-usd',
      code: 'USD',
      name: 'دلار آمریکا',
      isDefault: true,
      accountingCode: 'GL-USD',
    });
    const repository = buildRepository();
    const { service } = buildService({ repository });

    repository.find
      .mockResolvedValueOnce([usd])
      .mockResolvedValue([
        usd,
        row({ id: 'cur-irr', isDefault: true }),
      ]);

    const outcome = await service.bootstrap(authContext);

    expect(outcome).toMatchObject({
      kind: 'OK',
      message: 'ارز پایهٔ ریال ساخته شد',
    });
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'cur-usd' },
      expect.objectContaining({ isDefault: false }),
    );
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'IRR',
        isActive: true,
        isDefault: true,
      }),
    );
  });

  it('restores IRR as the operational default when another currency is marked default', async () => {
    const irr = row({ isDefault: false });
    const usd = row({
      id: 'cur-usd',
      code: 'USD',
      name: 'دلار آمریکا',
      isDefault: true,
    });
    const repository = buildRepository();
    const { service } = buildService({ repository });

    repository.find
      .mockResolvedValueOnce([irr, usd])
      .mockResolvedValue([
        row({ isDefault: true }),
        { ...usd, isDefault: false },
      ]);

    const outcome = await service.bootstrap(authContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'cur-usd' },
      expect.objectContaining({ isDefault: false }),
    );
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'cur-1' },
      expect.objectContaining({ isActive: true, isDefault: true }),
    );
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

  it('refuses accountingCode mutation when a quotation snapshotted a non-empty code for the currency id', async () => {
    const repository = buildRepository();
    const quotations = buildRepository();
    repository.find.mockResolvedValue([row({ accountingCode: 'OLD' })]);
    quotations.find.mockResolvedValue([
      {
        id: 'q-1',
        quotationCurrencyRecordId: 'cur-1',
        currencyAccountingCode: 'OLD',
      },
    ]);
    const { service } = buildService({ repository, quotations });

    const outcome = await service.saveCurrency(
      {
        recordId: 'cur-1',
        name: 'ریال ایران',
        accountingCodeText: 'NEW',
        isActive: true,
        isDefault: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_CODE_IN_USE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses saving a non-IRR currency as the operational default', async () => {
    const usd = row({
      id: 'cur-usd',
      code: 'USD',
      name: 'دلار آمریکا',
      isDefault: false,
    });
    const repository = buildRepository();
    repository.find.mockResolvedValue([row(), usd]);
    const { service } = buildService({ repository });

    const outcome = await service.saveCurrency(
      {
        recordId: 'cur-usd',
        name: 'دلار آمریکا',
        accountingCodeText: '',
        isActive: true,
        isDefault: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'QUOTATION_CURRENCY_DEFAULT_MUST_BE_IRR',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses setDefaultCurrency for a non-IRR row', async () => {
    const usd = row({
      id: 'cur-usd',
      code: 'USD',
      name: 'دلار آمریکا',
      isDefault: false,
    });
    const repository = buildRepository();
    repository.find.mockResolvedValue([row(), usd]);
    const { service } = buildService({ repository });

    const outcome = await service.setDefaultCurrency('cur-usd', authContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'QUOTATION_CURRENCY_DEFAULT_MUST_BE_IRR',
    });
    expect(repository.update).not.toHaveBeenCalled();
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
