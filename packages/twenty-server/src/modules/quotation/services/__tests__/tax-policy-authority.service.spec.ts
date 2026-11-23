import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { TaxPolicyAuthorityService } from 'src/modules/quotation/services/tax-policy-authority.service';

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
  id: 'tp-1',
  code: 'IR_VAT_9',
  name: 'مالیات بر ارزش افزوده ۹٪',
  rateBasisPoints: '900',
  isActive: true,
  isDefault: false,
  isExempt: false,
  ...overrides,
});

type Repository = {
  find: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

const buildRepository = (): Repository => ({
  find: jest.fn(async () => []),
  insert: jest.fn(async () => ({ identifiers: [{ id: 'tp-new' }] })),
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
    service: new TaxPolicyAuthorityService(
      workspaceOrmManager as never,
      permissionService as never,
    ),
    scope,
    workspaceOrmManager,
    permissionService,
  };
};

describe('TaxPolicyAuthorityService', () => {
  it('delegates settings authority to the role lookup without a permissive fallback', async () => {
    const repository = buildRepository();
    const { service, permissionService } = buildService({
      repository,
      authority: null,
    });

    await expect(service.resolveAuthority(authContext)).resolves.toBeNull();
    expect(permissionService.resolveSettingsAuthority).toHaveBeenCalledWith(
      authContext,
    );
  });

  it('reads the policy list without writing anything', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([row()]);
    const { service, workspaceOrmManager } = buildService({ repository });

    const outcome = await service.listPolicies(authContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(
      workspaceOrmManager.runInWorkspaceTransaction,
    ).not.toHaveBeenCalled();
  });

  it('creates the 9% baseline only when the workspace has no policy at all', async () => {
    const repository = buildRepository();
    repository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row({ isDefault: true })]);
    const { service } = buildService({ repository });

    const outcome = await service.bootstrap(authContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(repository.insert.mock.calls[0][0]).toMatchObject({
      code: 'IR_VAT_9',
      rateBasisPoints: '900',
      isActive: true,
      isDefault: true,
      // The audit columns are NOT NULL; an insert without an actor fails live even
      // though a mocked repository accepts it.
      createdBy: {
        source: 'MANUAL',
        name: 'فرید رفیعی',
        workspaceMemberId: 'wm-1',
      },
      updatedBy: {
        source: 'MANUAL',
        name: 'فرید رفیعی',
        workspaceMemberId: 'wm-1',
      },
    });
  });

  it('leaves an existing policy set untouched on a second bootstrap', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([row({ isDefault: true })]);
    const { service } = buildService({ repository });

    const outcome = await service.bootstrap(authContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('clears the previous default before setting the new one, inside one transaction', async () => {
    const repository = buildRepository();
    repository.find
      .mockResolvedValueOnce([
        row({ id: 'tp-1', isDefault: true }),
        row({ id: 'tp-2', code: 'TAX_1000', rateBasisPoints: '1000' }),
      ])
      .mockResolvedValueOnce([
        row({ id: 'tp-1', isDefault: false }),
        row({
          id: 'tp-2',
          code: 'TAX_1000',
          rateBasisPoints: '1000',
          isDefault: true,
        }),
      ])
      // The invariant read after the writes: exactly one active default.
      .mockResolvedValue([
        row({ id: 'tp-1', isDefault: false }),
        row({
          id: 'tp-2',
          code: 'TAX_1000',
          rateBasisPoints: '1000',
          isDefault: true,
        }),
      ]);
    const { service, scope, workspaceOrmManager } = buildService({
      repository,
    });

    const outcome = await service.setDefaultPolicy('tp-2', authContext);

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(workspaceOrmManager.runInWorkspaceTransaction).toHaveBeenCalledTimes(
      1,
    );
    // A per-workspace lock is what makes concurrent changes serialize.
    expect(scope.executeRawQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['quotation-tax-policy:workspace-1'],
    );
    expect(repository.update.mock.calls).toEqual([
      [
        { id: 'tp-1' },
        {
          isDefault: false,
          updatedBy: {
            source: 'MANUAL',
            name: 'فرید رفیعی',
            workspaceMemberId: 'wm-1',
            context: {},
          },
        },
      ],
      [
        { id: 'tp-2' },
        {
          isDefault: true,
          updatedBy: {
            source: 'MANUAL',
            name: 'فرید رفیعی',
            workspaceMemberId: 'wm-1',
            context: {},
          },
        },
      ],
    ]);
  });

  it('refuses a deactivated policy as default without writing', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([
      row({ id: 'tp-1', isActive: false }),
      row({ id: 'tp-2', code: 'TAX_1000' }),
    ]);
    const { service } = buildService({ repository });

    const outcome = await service.setDefaultPolicy('tp-1', authContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rolls the whole change back when a statement fails mid-way', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValueOnce([
      row({ id: 'tp-1', isDefault: true }),
      row({ id: 'tp-2', code: 'TAX_1000' }),
    ]);
    repository.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockRejectedValueOnce(new Error('write failed'));
    const { service } = buildService({ repository });

    await expect(
      service.setDefaultPolicy('tp-2', authContext),
    ).rejects.toThrow('write failed');
  });

  it('refuses an exemption flag that disagrees with the rate', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([row()]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: null,
        name: 'معاف',
        ratePercentText: '۹',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: false,
        isExempt: true,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_POLICY_EXEMPTION_MISMATCH',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('parses a Persian 10.5% rate into 1050 basis points', async () => {
    const repository = buildRepository();
    repository.find
      .mockResolvedValueOnce([row({ id: 'tp-1', isDefault: true })])
      .mockResolvedValueOnce([
        row({ id: 'tp-1', isDefault: true }),
        row({ id: 'tp-2', code: 'TAX_1050', rateBasisPoints: '1050' }),
      ])
      .mockResolvedValueOnce([
        row({ id: 'tp-1', isDefault: true }),
        row({ id: 'tp-2', code: 'TAX_1050', rateBasisPoints: '1050' }),
      ])
      .mockResolvedValue([
        row({ id: 'tp-1', isDefault: true }),
        row({ id: 'tp-2', code: 'TAX_1050', rateBasisPoints: '1050' }),
      ]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: null,
        name: 'مالیات ۱۰٫۵٪',
        ratePercentText: '۱۰٫۵',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: false,
        isExempt: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert.mock.calls[0][0]).toMatchObject({
      code: 'TAX_1050',
      rateBasisPoints: '1050',
    });
  });

  it('refuses to deactivate the last active policy', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([
      row({ id: 'tp-1', isActive: false, isDefault: true }),
      row({ id: 'tp-2', code: 'TAX_1000', isActive: true }),
    ]);
    const { service } = buildService({ repository });

    const outcome = await service.deactivatePolicy('tp-2', authContext);

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_POLICY_LAST_ACTIVE',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('never rewrites createdBy when editing a stored policy', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([row({ id: 'tp-1', isDefault: true })]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: 'tp-1',
        name: 'مالیات ۱۰٪',
        ratePercentText: '۱۰',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: true,
        isExempt: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });

    const updateColumns = repository.update.mock.calls.find(
      ([filter]) => filter.id === 'tp-1',
    )?.[1];

    // Who introduced the rate is history; an edit may only move updatedBy.
    expect(updateColumns).not.toHaveProperty('createdBy');
    expect(updateColumns).toMatchObject({
      updatedBy: {
        source: 'MANUAL',
        name: 'فرید رفیعی',
        workspaceMemberId: 'wm-1',
      },
    });
  });

  it('makes the first policy of an empty workspace the active default', async () => {
    const repository = buildRepository();
    repository.find
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        row({ id: 'tp-new', code: 'TAX_1000', rateBasisPoints: '1000', isActive: true, isDefault: true }),
      ]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: null,
        name: 'مالیات ۱۰٪',
        ratePercentText: '۱۰',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: false,
        isExempt: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect(repository.insert.mock.calls[0][0]).toMatchObject({
      isActive: true,
      isDefault: true,
    });
  });

  it('refuses an inactive first policy instead of creating a catalog without a rate', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: null,
        name: 'غیرفعال',
        ratePercentText: '۱۰',
        dutyRatePercentText: '',
        isActive: false,
        isDefault: false,
        isExempt: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({
      kind: 'REFUSED',
      code: 'TAX_POLICY_FIRST_MUST_BE_ACTIVE',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('repairs two active defaults to the oldest and reports the repair', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([
      row({ id: 'tp-1', isDefault: true }),
      row({ id: 'tp-2', code: 'TAX_1000', isDefault: true }),
    ]);
    const { service } = buildService({ repository });

    const outcome = await service.savePolicy(
      {
        recordId: null,
        name: 'مالیات ۱۲٪',
        ratePercentText: '۱۲',
        dutyRatePercentText: '',
        isActive: true,
        isDefault: false,
        isExempt: false,
      },
      authContext,
    );

    expect(outcome).toMatchObject({ kind: 'OK' });
    expect((outcome as { message: string }).message).toContain(
      'بازگردانده شد',
    );
    // The older row keeps the flag; the newer duplicate is cleared.
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'tp-2' },
      expect.objectContaining({ isDefault: false }),
    );
    expect(repository.update).not.toHaveBeenCalledWith(
      { id: 'tp-1' },
      expect.objectContaining({ isDefault: false }),
    );
  });

  it('aborts rather than persisting a catalog with no active policy', async () => {
    const repository = buildRepository();
    repository.find.mockResolvedValue([
      row({ id: 'tp-1', isActive: false, isDefault: true }),
    ]);
    const { service } = buildService({ repository });

    await expect(
      service.savePolicy(
        {
          recordId: null,
          name: 'تازه',
          ratePercentText: '۱۰',
          dutyRatePercentText: '',
          isActive: true,
          isDefault: false,
          isExempt: false,
        },
        authContext,
      ),
    ).rejects.toThrow('TAX_POLICY_INVARIANT_VIOLATED');
  });
});
