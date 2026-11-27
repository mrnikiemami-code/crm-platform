import { createHash } from 'node:crypto';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { CommonQueryRunnerException, CommonQueryRunnerExceptionCode } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { AccountingPartyApplyService, parseAccountingPartyPlan, parseAccountingPartySelections } from 'src/modules/quotation/services/accounting-party-apply.service';

const connectionId = '30000000-0000-4000-8000-000000000001';
const existingCustomer = '30000000-0000-4000-8000-000000000002';
const externalPartyId = 'UAT-001';
const stableId = (prefix: string) => {
  const hex = createHash('sha256').update(prefix + JSON.stringify([connectionId, externalPartyId])).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};
const app = { id: 'app-id', universalIdentifier: 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb', defaultRoleId: 'app-role' };
const authContext = { type: 'user', workspace: { id: 'workspace' }, user: { id: 'user' }, userWorkspaceId: 'membership', workspaceMemberId: 'member', workspaceMember: { id: 'member' } } as WorkspaceAuthContext;
const selections = parseAccountingPartySelections([{ externalPartyId, createNew: true }])!;
const row = {
  externalPartyId, partyType: 'PERSON', internalPartyId: stableId('quotation/accounting-customer:'),
  createCustomer: true, customerFields: { name: { firstName: 'Fixture', lastName: 'Only' } },
  expectedCustomerUpdatedAt: null, existingLinkId: null, linkId: stableId('quotation/accounting-party-link:'),
  expectedRemoteVersion: null, externalCode: '001', remoteVersion: 'v1', sourceProfile: null, name: 'Fixture Only', alreadySynchronized: false,
};
const notFound = () => new CommonQueryRunnerException('Record not found', CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND, { userFriendlyMessage: { id: 'not-found', message: 'Not found' } });
const setup = (authority = 'SETTINGS_ROLE') => {
  const metadata = ['person', 'company', 'accountingPartyLink'].map((nameSingular) => ({ id: nameSingular, nameSingular, namePlural: nameSingular + 's' }));
  const cache = { getOrRecompute: jest.fn(async () => ({ flatObjectMetadataMaps: { byUniversalIdentifier: Object.fromEntries(metadata.map((entry) => [entry.id, entry])) }, flatFieldMetadataMapsOrm: {}, flatIndexMaps: {} })) };
  const tx = { executeRawQuery: jest.fn(async () => []) };
  const commits: string[] = [];
  const orm = { executeInWorkspaceContext: jest.fn(async (work: () => Promise<unknown>) => work()),
    runInWorkspaceTransaction: jest.fn(async (work: (scope: typeof tx) => Promise<unknown>) => {
      try { const result = await work(tx); commits.push('COMMIT'); return result; }
      catch (error) { commits.push('ROLLBACK'); throw error; }
    }) };
  const find = { execute: jest.fn(async (_args: unknown, context: { flatObjectMetadata: { nameSingular: string } }) => {
    if (context.flatObjectMetadata.nameSingular === 'accountingPartyLink') throw notFound();
    return { results: { id: existingCustomer, updatedAt: new Date('2026-11-27T00:00:00.123Z') } };
  }) };
  const create = { execute: jest.fn(async (args: { data: { id: string } }, _context: unknown) => ({ results: { id: args.data.id } })) };
  const update = { execute: jest.fn(async (args: { id: string }, _context: unknown) => ({ results: { id: args.id } })) };
  const service = new AccountingPartyApplyService(cache as never, orm as never, { resolveSettingsAuthority: jest.fn(async () => authority || null), resolveRoleId: jest.fn(async () => 'user-role') } as never, find as never, create as never, update as never);
  const input = { connectionId, selections, allowUpdate: true, plan: { rows: [row], refused: [] }, authContext, app: app as never };
  return { service, input, create, update, find, commits };
};
describe('native accounting customer apply', () => {
  it('rejects injected fields, mismatched ids and duplicate selections before writing', () => {
    expect(parseAccountingPartySelections([{ externalPartyId, createNew: true }, { externalPartyId, createNew: true }])).toBeNull();
    expect(parseAccountingPartyPlan({ rows: [{ ...row, customerFields: { accountOwnerId: existingCustomer } }], refused: [] }, connectionId, selections, true)).toBeNull();
    expect(parseAccountingPartyPlan({ rows: [{ ...row, internalPartyId: existingCustomer }], refused: [] }, connectionId, selections, true)).toBeNull();
  });
  it('requires a user and settings authority', async () => {
    const { service, input, create } = setup('');
    await expect(service.apply(input)).resolves.toMatchObject({ success: false, code: 'FORBIDDEN' });
    await expect(service.apply({ ...input, authContext: { type: 'application', workspace: authContext.workspace, application: app as never } })).resolves.toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(create.execute).not.toHaveBeenCalled();
  });
  it('creates the customer and mapping in one scoped transaction using the original user and app-role intersection', async () => {
    const { service, input, create, commits } = setup();
    await expect(service.apply(input)).resolves.toMatchObject({ success: true, outcome: { createdParties: 1, createdLinks: 1, updatedLinks: 0, refused: [] } });
    expect(create.execute).toHaveBeenCalledTimes(2);
    expect(create.execute).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: row.internalPartyId }) }), expect.objectContaining({
      authContext: expect.objectContaining({ type: 'user', userWorkspaceId: 'membership', application: app }),
      rolePermissionConfig: { intersectionOf: ['user-role', 'app-role'] },
    }));
    expect(commits).toEqual(['COMMIT']);
  });
  it('does not count a customer if mapping write fails and transaction rolls back', async () => {
    const { service, input, create, commits } = setup();
    create.execute.mockResolvedValueOnce({ results: { id: row.internalPartyId } }).mockRejectedValueOnce(new Error('mapping failed'));
    await expect(service.apply(input)).resolves.toMatchObject({ success: true, outcome: { createdParties: 0, createdLinks: 0, refused: [{ detail: expect.stringContaining('MAPPING_WRITE') }] } });
    expect(commits).toEqual(['ROLLBACK']);
  });
  it('updates an existing customer without discarding timestamp milliseconds', async () => {
    const { service, input, update, commits } = setup();
    const existing = { ...row, createCustomer: false, internalPartyId: existingCustomer, expectedCustomerUpdatedAt: '2026-11-27T00:00:00.123Z' };
    await expect(service.apply({ ...input, plan: { rows: [existing], refused: [] } })).resolves.toMatchObject({ success: true, outcome: { createdParties: 0, createdLinks: 1, refused: [] } });
    expect(update.execute).toHaveBeenCalledTimes(1);
    expect(commits).toEqual(['COMMIT']);
  });
});
