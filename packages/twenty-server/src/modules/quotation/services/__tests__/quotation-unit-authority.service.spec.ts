import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationUnitAuthorityService } from 'src/modules/quotation/services/quotation-unit-authority.service';

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
  id: 'unit-1',
  code: 'UNIT_1',
  name: 'عدد',
  isActive: true,
  accountingCode: '100',
  ...overrides,
});

type Repository = {
  find: jest.Mock;
  findOne: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

const buildRepository = (): Repository => ({
  find: jest.fn(async () => []),
  findOne: jest.fn(async () => ({ id: 'unit-1', accountingCodeLocked: false })),
  insert: jest.fn(async () => ({ identifiers: [{ id: 'unit-new' }] })),
  update: jest.fn(async () => ({ affected: 1 })),
});

const buildService = ({
  repository,
  authority = 'SETTINGS_ROLE',
  catalogItems = buildRepository(),
}: {
  repository: Repository;
  authority?: string | null;
  catalogItems?: Repository;
}) => {
  const scope = {
    workspaceId: 'workspace-1',
    executeRawQuery: jest.fn(async () => []),
    getRepository: jest.fn((objectName: string) =>
      objectName === 'catalogItem' ? catalogItems : repository,
    ),
  };
  const workspaceOrmManager = {
    getRepository: jest.fn((objectName: string) =>
      objectName === 'catalogItem' ? catalogItems : repository,
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
    service: new QuotationUnitAuthorityService(
      workspaceOrmManager as never,
      permissionService as never,
    ),
    scope,
    repository,
    catalogItems,
  };
};

describe('QuotationUnitAuthorityService', () => {
  it('creates a unit with the next internal code', async () => {
    const repository = buildRepository();
    const { service } = buildService({ repository });

    repository.find.mockResolvedValueOnce([]).mockResolvedValue([row()]);

    const outcome = await service.saveUnit(
      {
        recordId: null,
        name: 'عدد',
        accountingCodeText: '100',
        isActive: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNIT_1',
        name: 'عدد',
        accountingCode: '100',
      }),
    );
  });

  it('refuses duplicate nonempty accounting codes', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([
      row({ id: 'unit-1', accountingCode: '100' }),
    ]);
    const { service } = buildService({ repository });

    const outcome = await service.saveUnit(
      {
        recordId: null,
        name: 'کیلوگرم',
        accountingCodeText: '100',
        isActive: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'QUOTATION_UNIT_ACCOUNTING_CODE_DUPLICATE',
    });
  });

  it('refuses accounting code edits after durable first use even without catalog references', async () => {
    const repository = buildRepository();
    const catalogItems = buildRepository();
    repository.find.mockResolvedValue([row()]);
    repository.findOne.mockResolvedValue({ id: 'unit-1', accountingCodeLocked: true });
    catalogItems.find.mockResolvedValue([]);
    const { service } = buildService({ repository, catalogItems });

    const outcome = await service.saveUnit(
      {
        recordId: 'unit-1',
        name: 'عدد',
        accountingCodeText: '200',
        isActive: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'ACCOUNTING_CODE_IN_USE',
    });
  });
});