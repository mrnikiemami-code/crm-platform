import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPartyWriteGuardService } from 'src/modules/quotation/services/accounting-party-write-guard.service';

const app = { universalIdentifier: 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb' };
const user = { type: 'user', application: app } as WorkspaceAuthContext;
const machine = { type: 'application', application: app } as WorkspaceAuthContext;
describe('accounting customer scoped writes', () => {
  it('requires a delegated settings user and refuses unrelated fields and bulk mutations', async () => {
    const guard = new AccountingPartyWriteGuardService({ resolveSettingsAuthority: jest.fn(async () => 'SETTINGS_ROLE') } as never);
    await expect(guard.assertAllowed(user, 'person', 'createOne', { data: { name: { firstName: 'Test' }, nationalCode: '0012345678' } })).resolves.toBeUndefined();
    await expect(guard.assertAllowed(machine, 'person', 'createOne', { data: { name: {} } })).rejects.toThrow('ACCOUNTING_PARTY_WRITE_FORBIDDEN');
    await expect(guard.assertAllowed(user, 'company', 'updateOne', { data: { accountOwnerId: 'other' } })).rejects.toThrow('ACCOUNTING_PARTY_WRITE_FORBIDDEN');
    await expect(guard.assertAllowed(user, 'person', 'mergeMany', {})).rejects.toThrow('ACCOUNTING_PARTY_WRITE_FORBIDDEN');
    const limited = new AccountingPartyWriteGuardService({ resolveSettingsAuthority: jest.fn(async () => null) } as never);
    await expect(limited.assertAllowed(user, 'person', 'updateOne', { data: { name: {} } })).rejects.toThrow('ACCOUNTING_PARTY_WRITE_FORBIDDEN');
  });
});
