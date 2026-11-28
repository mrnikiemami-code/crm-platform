import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPartyOutboundService, buildPartyOutboundProfile, parsePartyOutboundRequest } from 'src/modules/quotation/services/accounting-party-outbound.service';

describe('customer outbound request authority', () => {
  it('discards browser-supplied profile and preserves only record identity', () => {
    const request = { connectionId: '11111111-1111-4111-8111-111111111111', internalPartyId: '22222222-2222-4222-8222-222222222222', partyType: 'PERSON' };
    expect(parsePartyOutboundRequest({ ...request, profile: { fullName: 'fake' } })).toEqual(request);
    expect(parsePartyOutboundRequest({ ...request, expectedFingerprint: 'invalid' })).toBeNull();
  });
  it('reads native Person fields and preserves national leading zeroes', () => {
    expect(buildPartyOutboundProfile('PERSON', {
      name: { firstName: 'علی', lastName: 'احمدی' }, nationalCode: '۰۰۱۲۳۴۵۶۷۸',
      phones: { primaryPhoneNumber: '+989121234567' },
      accountingAddress: { addressStreet1: 'خیابان اول', addressCity: 'تهران', addressPostcode: '0123456789' },
    }, null)).toMatchObject({ fullName: 'علی احمدی', nationalCode: '0012345678', mobile: '09121234567', address: 'خیابان اول، تهران', postalCode: '0123456789' });
  });
  it('does not invent a legal identity or send unsupported fields', () => {
    expect(buildPartyOutboundProfile('COMPANY', { name: 'شرکت', nationalCode: '0012345678' }, null)).toBeNull();
    const profile = buildPartyOutboundProfile('COMPANY', { name: 'شرکت', nationalCode: '10101010101', accountingEmail: 'a@example.invalid' }, '42');
    expect(profile).toMatchObject({ legalNationalId: '10101010101', externalPartyId: '42' });
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('accountGroup');
  });
});

const connectionId = '11111111-1111-4111-8111-111111111111';
const internalPartyId = '22222222-2222-4222-8222-222222222222';
const request = { connectionId, internalPartyId, partyType: 'PERSON' as const };
const authContext = { type: 'user', workspace: { id: 'ws-1' } } as WorkspaceAuthContext;

const setup = () => {
  const operations: Record<string, unknown>[] = [];
  const links: Record<string, unknown>[] = [];
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => row[key] === value);
  const customer = { id: internalPartyId, name: { firstName: 'علی', lastName: 'آزمون' }, nationalCode: '0012345678', phones: { primaryPhoneNumber: '09121234567' } };
  const repositories = {
    accountingConnection: { findOne: jest.fn(async () => ({ id: connectionId, adapterId: 'mock', adapterVersion: 'v1', isActive: true })) },
    person: { findOne: jest.fn(async () => customer), find: jest.fn(async () => [{ id: internalPartyId }]) },
    company: { find: jest.fn(async () => []) },
    accountingPartyLink: {
      find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => links.filter(row => match(row, where))),
      insert: jest.fn(async (row: Record<string, unknown>) => { links.push(row); return { identifiers: [{ id: row.id }] }; }),
      update: jest.fn(async (where: Record<string, unknown>, data: Record<string, unknown>) => {
        const row = links.find(candidate => match(candidate, where)); if (!row) return { affected: 0 }; Object.assign(row, data); return { affected: 1 };
      }),
    },
    accountingSyncOperation: {
      find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => operations.filter(row => match(row, where))),
      insert: jest.fn(async (row: Record<string, unknown>) => { operations.push(row); return { identifiers: [{ id: row.id }] }; }),
      update: jest.fn(async (where: Record<string, unknown>, data: Record<string, unknown>) => {
        const row = operations.find(candidate => match(candidate, where)); if (!row) return { affected: 0 }; Object.assign(row, data); return { affected: 1 };
      }),
    },
  };
  const scope = { workspaceId: 'ws-1', executeRawQuery: jest.fn(async () => []), getRepository: jest.fn((name: keyof typeof repositories) => repositories[name]) };
  let depth = 0;
  let committedClaim = false;
  const transaction = jest.fn(async (work: (scope: unknown) => Promise<unknown>) => {
    depth++;
    try { const result = await work(scope); if (depth === 2 && operations[0]?.state === 'IN_FLIGHT') committedClaim = true; return result; }
    finally { depth--; }
  });
  const orm = { executeInWorkspaceContext: jest.fn(async (work: () => Promise<unknown>) => work()), runInWorkspaceTransaction: transaction };
  const service = new AccountingPartyOutboundService(orm as never, { resolveSettingsAuthority: jest.fn(async () => 'SETTINGS_ROLE'), resolveRoleId: jest.fn(async () => 'role-1') } as never);
  const worker = jest.fn(async (action: string, body: Record<string, unknown>) => {
    if (action === 'preview-party-push') return { success: true, canExecute: true };
    expect(committedClaim).toBe(true);
    expect(operations[0]).toMatchObject({ state: 'IN_FLIGHT', attempts: 1 });
    expect(body.command).toMatchObject({ mode: 'CREATE', profile: { fullName: 'علی آزمون' } });
    return { success: true, outcome: { externalPartyId: '42', externalCode: '42', remoteVersion: 'remote-v1', sourceProfile: null } };
  });
  return { service, worker, operations, links };
};

describe('customer outbound durable claim source fixtures (not PostgreSQL proof)', () => {
  it('commits intent before the worker, and links only with matching completion', async () => {
    const { service, worker, operations, links } = setup();
    const preview = await service.run(request, false, authContext, worker);
    if (!preview.success || !('preview' in preview) || !preview.preview) throw new Error('preview failed');
    expect(await service.run({ ...request, expectedFingerprint: preview.preview.fingerprint }, true, authContext, worker)).toMatchObject({ success: true, outcome: { externalPartyId: '42' } });
    expect(operations[0]).toMatchObject({ state: 'SUCCEEDED', externalDocumentId: '42' });
    expect(links[0]).toMatchObject({ internalPartyId, externalPartyId: '42', syncStatus: 'LINKED' });
    expect(JSON.stringify(operations[0])).not.toContain('09121234567');
  });
  it('retains an uncertain claim without linking or replaying', async () => {
    const { service, worker, operations, links } = setup();
    const preview = await service.run(request, false, authContext, worker);
    if (!preview.success || !('preview' in preview) || !preview.preview) throw new Error('preview failed');
    worker.mockImplementation(async action => {
      if (action === 'preview-party-push') return { success: true, canExecute: true };
      throw new Error('transport reset');
    });
    const execution = { ...request, expectedFingerprint: preview.preview.fingerprint };
    expect(await service.run(execution, true, authContext, worker)).toMatchObject({ success: false, code: 'RECONCILIATION_REQUIRED' });
    expect(operations[0]).toMatchObject({ state: 'MANUAL_EXPORT_REQUIRED' });
    expect(links).toHaveLength(0);
    expect(await service.run(execution, true, authContext, worker)).toMatchObject({ success: false });
    expect(worker.mock.calls.filter(([action]) => action === 'execute-party-push')).toHaveLength(1);
  });
});
