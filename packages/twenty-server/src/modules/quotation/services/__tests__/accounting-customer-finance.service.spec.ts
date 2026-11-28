import { createHash } from 'node:crypto';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingCustomerFinanceService, parseCustomerFinanceRequest } from 'src/modules/quotation/services/accounting-customer-finance.service';

const connectionId = '11111111-1111-4111-8111-111111111111';
const internalPartyId = '22222222-2222-4222-8222-222222222222';
const input = { connectionId, internalPartyId, partyType: 'PERSON' as const, report: 'SUMMARY' as const };
const auth = { type: 'user', workspace: { id: 'ws-1' }, user: { id: 'u-1' }, userWorkspaceId: 'uw-1' } as WorkspaceAuthContext;
const link = { id: 'link-1', externalPartyId: '42', internalPartyId, partyType: 'PERSON', syncStatus: 'LINKED', remoteVersion: 'v1' };
const quotationId = '33333333-3333-4333-8333-333333333333';
const operationId = '44444444-4444-5444-8444-444444444444';
const payloadSnapshot = JSON.stringify({ schemaVersion: 1 });
const claim = { id: operationId, connectionId, internalEntityId: quotationId, internalRevision: 1, kind: 'QUOTATION_REVISION_PUSH', correlationId: operationId, state: 'MANUAL_EXPORT_REQUIRED', attempts: 1, payloadFingerprint: createHash('sha256').update(payloadSnapshot).digest('hex'), payloadSnapshot, externalDocumentId: null };
const setup = (options: { authority?: string | null; visible?: boolean; active?: boolean; links?: typeof link[]; auditFails?: boolean } = {}) => {
  const sourceRows = options.links ?? [link];
  const repositories = {
    accountingFinanceAccess: { insert: jest.fn(async (row: Record<string, unknown>) => { if (options.auditFails) throw new Error('audit unavailable'); return { identifiers: [{ id: row.id }] }; }) },
    quotation: { findOne: jest.fn(async () => options.visible === false ? null : { id: quotationId }) },
    accountingSyncOperation: { find: jest.fn(async () => [claim]) },
    person: { findOne: jest.fn(async () => options.visible === false ? null : { id: internalPartyId }) },
    accountingConnection: { findOne: jest.fn(async () => ({ id: connectionId, isActive: options.active !== false, adapterId: 'asan', datasetBindingId: 'dataset-1' })) },
    accountingPartyLink: { find: jest.fn(async () => sourceRows) },
  };
  const scope = { workspaceId: 'ws-1', executeRawQuery: jest.fn(async () => []), getRepository: jest.fn((name: keyof typeof repositories) => repositories[name]) };
  const orm = { executeInWorkspaceContext: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    runInWorkspaceTransaction: jest.fn(async (fn: (scope: unknown) => Promise<unknown>) => fn(scope)) };
  const permissions = { resolveSettingsAuthority: jest.fn(async () => options.authority === undefined ? 'SETTINGS_ROLE' : options.authority),
    resolveRoleId: jest.fn(async () => 'role-1') };
  const service = new AccountingCustomerFinanceService(orm as never, permissions as never);
  const worker = jest.fn(async (_command: Record<string, unknown>) => ({ success: true, observation: {
    connectionId, customerExternalId: '42', report: 'SUMMARY', adapterId: 'asan', certified: false,
  } }));
  return { service, worker, scope, repositories };
};

describe('restricted original-user customer finance authority', () => {
  it('validates bounded date/count inputs and discards caller vendor identity', () => {
    expect(parseCustomerFinanceRequest({ ...input, externalPartyId: '999', baseUrl: 'https://other.invalid' })).toEqual(input);
    expect(parseCustomerFinanceRequest({ ...input, report: 'CARDEX', from: '2026-02-30', to: '2026-03-02' })).toBeNull();
    expect(parseCustomerFinanceRequest({ ...input, report: 'CARDEX', from: '2026-01-01', to: '2026-04-04' })).toBeNull();
    expect(parseCustomerFinanceRequest({ ...input, report: 'PROFORMAS', count: 101 })).toBeNull();
    expect(parseCustomerFinanceRequest({ ...input, report: 'PROFORMAS', count: 20 })).toEqual({ ...input, report: 'PROFORMAS', count: 20 });
  });

  it('denies settings-less, hidden, retired and ambiguous customer reads before any worker call', async () => {
    for (const options of [{ authority: null }, { visible: false }, { active: false }, { links: [link, { ...link, id: 'duplicate' }] }]) {
      const { service, worker } = setup(options);
      expect(await service.read(input, auth, worker)).toMatchObject({ success: false });
      expect(worker).not.toHaveBeenCalled();
    }
  });

  it('requires an exact forward/reverse link and holds the lifecycle lock across the private read', async () => {
    const { service, worker, scope, repositories } = setup();
    expect(await service.read(input, auth, worker)).toMatchObject({ success: true });
    expect(scope.getRepository).toHaveBeenCalledWith('person', { unionOf: ['role-1'] });
    expect(scope.executeRawQuery).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock_shared(hashtext($1))', ['quotation-accounting-connection:ws-1']);
    expect(repositories.accountingPartyLink.find).toHaveBeenCalledTimes(3);
    expect(worker).toHaveBeenCalledWith({ connectionId, externalPartyId: '42', report: 'SUMMARY' });
    const audit = repositories.accountingFinanceAccess.insert;
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[0][0]).toMatchObject({ actorWorkspaceId: 'uw-1', subjectType: 'PERSON', subjectId: internalPartyId, phase: 'REQUESTED', outcomeCode: 'AUTHORIZED' });
    expect(audit.mock.invocationCallOrder[0]).toBeLessThan(worker.mock.invocationCallOrder[0]);
    expect(audit.mock.calls[1][0]).toMatchObject({ requestId: audit.mock.calls[0][0].requestId, phase: 'COMPLETED', outcomeCode: 'OBSERVATION_RETURNED' });
    expect(audit.mock.calls[1][0]).not.toHaveProperty('observation');
  });

  it('does not contact the vendor when the durable audit intent cannot be recorded', async () => {
    const { service, worker } = setup({ auditFails: true });
    expect(await service.read(input, auth, worker)).toMatchObject({ success: false });
    expect(worker).not.toHaveBeenCalled();
  });

  it('does not disclose an observation if the completion audit fails', async () => {
    const { service, worker, repositories } = setup();
    repositories.accountingFinanceAccess.insert.mockImplementationOnce(async row => ({ identifiers: [{ id: row.id }] }))
      .mockRejectedValueOnce(new Error('audit failed'));
    expect(await service.read(input, auth, worker)).toMatchObject({ success: false });
    expect(worker).toHaveBeenCalledTimes(1);
  });

  it('rejects mismatched returned customer or certified claims', async () => {
    const { service, worker } = setup();
    worker.mockResolvedValueOnce({ success: true, observation: { connectionId, customerExternalId: '43', report: 'SUMMARY', adapterId: 'asan', certified: false } });
    expect(await service.read(input, auth, worker)).toMatchObject({ success: false, code: 'ASAN_INCOMPLETE_DATASET' });
    worker.mockResolvedValueOnce({ success: true, observation: { connectionId, customerExternalId: '42', report: 'SUMMARY', adapterId: 'asan', certified: true } });
    expect(await service.read(input, auth, worker)).toMatchObject({ success: false, code: 'ASAN_INCOMPLETE_DATASET' });
  });
});

describe('durable reconciliation evidence', () => {
  const request = { connectionId, quotationId, operationId };
  const observation = { status: 'DETAILS_OBSERVED', externalDocumentId: '42', priceFieldsEqual: true, reportCount: 2, fiscalConfirmed: false, replayAllowed: false };
  it('records bounded evidence without changing the operation state or authorizing retry', async () => {
    const { service, repositories, scope } = setup();
    const worker = jest.fn(async () => ({ success: true, observation }));
    expect(await service.reconcile(request, auth, worker)).toMatchObject({ success: true, observation: { ...observation, claimState: 'MANUAL_EXPORT_REQUIRED', payloadFingerprint: claim.payloadFingerprint } });
    expect(worker).toHaveBeenCalledWith(request);
    expect(scope.executeRawQuery).toHaveBeenNthCalledWith(2, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['accounting-quotation-work', 'ws-1', connectionId, quotationId])]);
    const audit = repositories.accountingFinanceAccess.insert;
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[1][0]).toMatchObject({ operationId, subjectType: 'QUOTATION', subjectId: quotationId, outcomeCode: 'RECONCILIATION_OBSERVED' });
    expect(JSON.parse(String(audit.mock.calls[1][0].evidenceJson))).toMatchObject({ ...observation, payloadFingerprint: claim.payloadFingerprint });
    expect(audit.mock.calls[1][0]).not.toHaveProperty('payloadSnapshot');
    expect(repositories.accountingSyncOperation.find).toHaveBeenCalledTimes(2);
  });

  it('does not return evidence if the claim changes or the worker asserts fiscal success', async () => {
    const first = setup();
    first.repositories.accountingSyncOperation.find.mockResolvedValueOnce([claim]).mockResolvedValueOnce([{ ...claim, state: 'SUCCEEDED' }]);
    const worker = jest.fn(async () => ({ success: true, observation }));
    expect(await first.service.reconcile(request, auth, worker)).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED' });
    const second = setup();
    expect(await second.service.reconcile(request, auth, async () => ({ success: true, observation: { ...observation, fiscalConfirmed: true } }))).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED' });
  });
});
