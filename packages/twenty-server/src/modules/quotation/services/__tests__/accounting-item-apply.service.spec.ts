import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingItemApplyService, parseAccountingItemPlan, parseAccountingItemSelections } from 'src/modules/quotation/services/accounting-item-apply.service';

const authContext = { type: 'user', workspace: { id: 'ws-1' } } as WorkspaceAuthContext;
const selection = { externalItemId: '100', expectedRemoteVersion: 'v1', unitRecordId: 'unit-1', kind: 'PRODUCT' as const };
const selections = [selection];
const row = { externalItemId: '100', remoteVersion: 'v1', action: 'CREATE_CATALOG_ITEM',
  internalItemId: null, expectedLinkId: null, expectedLinkVersion: null, code: '100', name: 'کالا',
  secondaryName: null, priceMicros: '100.000000', unitRecordId: 'unit-1', kind: 'PRODUCT',
  vendorUnitId: '004', vendorUnitName: 'عدد', observation: { version: '1', serial: 'abc' } };
const plan = { connectionId: 'c-1', applyPrices: true, rows: [row], refused: [] };
const setup = (priceFails = false) => {
  const insert = jest.fn(async (data: { id: string }) => ({ identifiers: [{ id: data.id }] }));
  const priceInsert = jest.fn(async (data: { id: string }) => {
    if (priceFails) throw new Error('fixture price failure');
    return { identifiers: [{ id: data.id }] };
  });
  const linkInsert = jest.fn(async (data: { id: string }) => ({ identifiers: [{ id: data.id }] }));
  const repositories: Record<string, unknown> = {
    accountingConnection: { findOne: jest.fn(async () => ({ id: 'c-1', isActive: true, adapterId: 'mock' })) },
    catalogItem: { find: jest.fn(async () => []), insert },
    accountingItemLink: { find: jest.fn(async () => []), insert: linkInsert },
    quotationUnit: { findOne: jest.fn(async () => ({ id: 'unit-1', name: 'عدد', isActive: true })) },
    priceList: { find: jest.fn(async () => [{ id: 'list-1', currencyCode: 'IRR', isDefault: true }]) },
    price: { find: jest.fn(async () => []), insert: priceInsert },
  };
  const scope = { workspaceId: 'ws-1', executeRawQuery: jest.fn(async () => []), getRepository: jest.fn((name: string) => repositories[name]) };
  const transaction = jest.fn(async (work: (scope: unknown) => Promise<unknown>) => work(scope));
  const orm = { executeInWorkspaceContext: jest.fn(async (work: () => Promise<unknown>) => work()), runInWorkspaceTransaction: transaction };
  const service = new AccountingItemApplyService(orm as never, { resolveSettingsAuthority: jest.fn(async () => 'SETTINGS_ROLE') } as never);
  return { service, transaction, insert, priceInsert, linkInsert };
};
const input = { connectionId: 'c-1', selections, applyPrices: true, allowUpdate: false, plan, authContext };

describe('Goal 040 atomic item apply source boundary', () => {
  it('rejects duplicate selections, stale versions and unconfirmed kind', () => {
    expect(parseAccountingItemSelections([selection, selection])).toBeNull();
    expect(parseAccountingItemPlan(plan, 'c-1', [{ ...selection, expectedRemoteVersion: 'stale' }], true, false)).toBeNull();
    expect(parseAccountingItemPlan(plan, 'c-1', [{ ...selection, kind: 'SERVICE' }], true, false)).toBeNull();
  });

  it('executes item, price and link in one transaction and preserves observation', async () => {
    const { service, transaction, insert, priceInsert, linkInsert } = setup();
    expect(await service.apply(input)).toMatchObject({ success: true, outcome: { createdItems: 1, createdPrices: 1, createdLinks: 1 } });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ unitRecordId: 'unit-1', kind: 'PRODUCT' }));
    expect(priceInsert).toHaveBeenCalledWith(expect.objectContaining({ unitPriceExact: '100.000000' }));
    expect(linkInsert).toHaveBeenCalledWith(expect.objectContaining({ observationJson: expect.stringContaining('"serial":"abc"') }));
  });

  it('reports failure without advancing the link on price error (real PG rollback remains a separate gate)', async () => {
    const { service, transaction, linkInsert } = setup(true);
    expect(await service.apply(input)).toMatchObject({ success: false, code: 'PERSISTENCE_FAILED' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(linkInsert).not.toHaveBeenCalled();
  });
});
