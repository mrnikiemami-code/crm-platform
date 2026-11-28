import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingOperationDispatchService, ACCOUNTING_OPERATION_ACTIONS } from 'src/modules/quotation/services/accounting-operation-dispatch.service';

const auth = {
  type: 'user', workspace: { id: 'ws-1' }, user: { id: 'u-1' }, userWorkspaceId: 'uw-1',
} as WorkspaceAuthContext;

const setup = (authority: string | null, legacy = false, visible = true) => {
  const execute = jest.fn(async () => ({ status: 'SUCCESS', data: { success: true } }));
  const cache = { getOrRecompute: jest.fn(async () => ({
    flatLogicFunctionMaps: { byUniversalIdentifier: {
      'b257fa8c-38a4-5cec-ba65-0cf27634abf9': { id: 'import-fn', applicationId: 'app', httpRouteTriggerSettings: legacy ? {} : null },
      'f55e7a5a-81af-562c-b96b-1f95fb102ec7': { id: 'outbound-fn', applicationId: 'app', httpRouteTriggerSettings: null },
    } },
    flatApplicationMaps: { byId: { app: { universalIdentifier: 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb' } } },
  })) };
  const lock = jest.fn(async () => undefined);
  const manager = {
    runInWorkspaceTransaction: jest.fn(async (work: (scope: unknown) => Promise<unknown>) =>
      work({ workspaceId: 'ws-1', executeRawQuery: lock })),
    executeInWorkspaceContext: jest.fn(async (work: () => Promise<unknown>) => work()),
    getRepository: jest.fn(() => ({ findOne: jest.fn(async () => visible ? { id: 'q-1' } : null) })),
  };
  const apply = jest.fn(async () => ({ success: true, outcome: { createdParties: 1 } }));
  const applyItems = jest.fn(async () => ({ success: true, outcome: { createdItems: 1 } }));
  const service = new AccountingOperationDispatchService(
    cache as never, { execute } as never,
    { resolveSettingsAuthority: jest.fn(async () => authority), resolveRoleId: jest.fn(async () => 'role-1') } as never,
    manager as never, { apply } as never, { apply: applyItems } as never,
  );
  return { service, execute, manager, apply, applyItems, lock };
};

describe('accounting operation boundary', () => {
  it('keeps health dispatch private and applies settings authority before invoking it', async () => {
    expect(ACCOUNTING_OPERATION_ACTIONS).not.toContain('accounting-internal-probe-connection');
    const denied = setup(null);
    expect(await denied.service.dispatch('accounting-internal-probe-connection', { connectionId: 'c' }, auth))
      .toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(denied.execute).not.toHaveBeenCalled();
    const granted = setup('SETTINGS_ROLE');
    expect(await granted.service.dispatch('accounting-internal-probe-connection', { connectionId: 'c' }, auth))
      .toEqual({ success: true });
    expect(granted.execute).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1',
      logicFunctionId: 'import-fn', payload: expect.objectContaining({ body: { connectionId: 'c', action: 'probe-connection' } }) }));
  });

  it('refuses unattended customer writes before dispatch', async () => {
    const { service, execute } = setup('SETTINGS_ROLE');
    const app = { type: 'application', workspace: { id: 'ws-1' }, application: { universalIdentifier: 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb' } } as WorkspaceAuthContext;
    expect(await service.dispatch('accounting-import-apply-parties', { connectionId: 'c' }, app)).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses the private read-only planner and original Nest caller for customer writes', async () => {
    const { service, execute, apply } = setup('SETTINGS_ROLE');
    const plan = { rows: [], refused: [] };
    execute.mockResolvedValueOnce({ status: 'SUCCESS', data: { success: true, plan } } as never);
    await expect(service.dispatch('accounting-import-apply-parties', {
      connectionId: 'c', selections: [{ externalPartyId: '001', createNew: true }], plan: { injected: true },
    }, auth)).resolves.toMatchObject({ success: true, outcome: { createdParties: 1 } });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ body: {
      connectionId: 'c', selections: [{ externalPartyId: '001', createNew: true }], allowRemoteVersionUpdate: false, action: 'prepare-parties',
    } }) }));
    expect(execute).not.toHaveBeenCalledWith(expect.objectContaining({ userId: expect.anything() }));
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ authContext: auth, plan }));
  });
  it('uses the private prepared item plan and original user, never a caller-injected plan', async () => {
    const { service, execute, applyItems } = setup('SETTINGS_ROLE');
    const selections = [{ externalItemId: '001', expectedRemoteVersion: 'v1', unitRecordId: 'unit-1', kind: 'PRODUCT' }];
    const plan = { connectionId: 'c', rows: [], refused: [] };
    execute.mockResolvedValueOnce({ status: 'SUCCESS', data: { success: true, plan } } as never);
    await expect(service.dispatch('accounting-import-apply-items', { connectionId: 'c', selections, applyPrices: true, plan: { injected: true } }, auth))
      .resolves.toMatchObject({ success: true });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ body: {
      connectionId: 'c', selections, applyPrices: true, allowRemoteVersionUpdate: false, action: 'prepare-items',
    } }) }));
    expect(applyItems).toHaveBeenCalledWith(expect.objectContaining({ plan, authContext: auth }));
  });

  it('holds the workspace work lock before executing a mutating private operation', async () => {
    const { service, execute, lock } = setup('SETTINGS_ROLE');
    execute.mockImplementationOnce(async () => {
      expect(lock).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock_shared(hashtext($1))',
        ['quotation-accounting-connection:ws-1']);
      return { status: 'SUCCESS', data: { success: true } };
    });
    expect(await service.dispatch('accounting-outbound-execute-quotation-export',
      { connectionId: 'c', quotationId: 'q-1' }, auth)).toEqual({ success: true });
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('rejects unlisted actions and unprivileged global operations before execution', async () => {
    const { service, execute } = setup(null);
    expect(await service.dispatch('invented', {}, auth)).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(await service.dispatch('accounting-import-apply-items', { connectionId: 'c', selections: [{ externalItemId: '001', expectedRemoteVersion: 'v1' }] }, auth)).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses the authenticated workspace and fixed installed function, not caller identifiers', async () => {
    const { service, execute } = setup('SETTINGS_ROLE');
    expect(await service.dispatch('accounting-import-preview-items-page', {
      connectionId: 'c', workspaceId: 'other', logicFunctionId: 'other', action: 'execute-item-push',
    }, auth)).toEqual({ success: true });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1', logicFunctionId: 'import-fn', userId: 'u-1',
      payload: expect.objectContaining({ body: expect.objectContaining({ action: 'preview-items-page' }) }),
    }));
  });

  it('refuses old public route installations and hidden quotations', async () => {
    const old = setup('SETTINGS_ROLE', true);
    expect(await old.service.dispatch('accounting-import-preview-items-page', { connectionId: 'c' }, auth)).toMatchObject({ success: false, code: 'ACCOUNTING_RUNTIME_UNAVAILABLE' });
    expect(old.execute).not.toHaveBeenCalled();
    const hidden = setup(null, false, false);
    expect(await hidden.service.dispatch('accounting-outbound-preview-quotation-export', { connectionId: 'c', quotationId: 'q-1' }, auth)).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(hidden.execute).not.toHaveBeenCalled();
  });

  it('allows record-scoped preview after a non-bypassed read but not document export without settings authority', async () => {
    const { service, execute, manager } = setup(null);
    expect(await service.dispatch('accounting-outbound-preview-quotation-export', { connectionId: 'c', quotationId: 'q-1' }, auth)).toEqual({ success: true });
    expect(manager.getRepository).toHaveBeenCalledWith('quotation', { unionOf: ['role-1'] });
    expect(await service.dispatch('accounting-outbound-execute-quotation-export', { connectionId: 'c', quotationId: 'q-1' }, auth)).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
