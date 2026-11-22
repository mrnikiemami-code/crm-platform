import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { AccountingConnectionCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-create-many.pre-query.hook';
import { AccountingConnectionCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-create-one.pre-query.hook';
import { AccountingConnectionDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-delete-many.pre-query.hook';
import { AccountingConnectionDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-delete-one.pre-query.hook';
import { AccountingConnectionDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-destroy-many.pre-query.hook';
import { AccountingConnectionDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-destroy-one.pre-query.hook';
import { AccountingConnectionMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-merge-many.pre-query.hook';
import { AccountingConnectionRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-restore-many.pre-query.hook';
import { AccountingConnectionRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-restore-one.pre-query.hook';
import { AccountingConnectionUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-update-many.pre-query.hook';
import { AccountingConnectionUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/accounting-connection-update-one.pre-query.hook';
import { AccountingConnectionWriteGuardService } from 'src/modules/quotation/services/accounting-connection-write-guard.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

type AccountingHookConstructor = new (
  writeGuardService: AccountingConnectionWriteGuardService,
) => WorkspacePreQueryHookInstance;

// A missing hook is a bypass: the platform generates all eleven mutations for any
// workspace object, and only this set keeps a caller from storing an arbitrary
// destination or flipping the record back to a verified state.
const ACCOUNTING_CONNECTION_HOOKS: AccountingHookConstructor[] = [
  AccountingConnectionCreateOnePreQueryHook,
  AccountingConnectionCreateManyPreQueryHook,
  AccountingConnectionUpdateOnePreQueryHook,
  AccountingConnectionUpdateManyPreQueryHook,
  AccountingConnectionDeleteOnePreQueryHook,
  AccountingConnectionDeleteManyPreQueryHook,
  AccountingConnectionDestroyOnePreQueryHook,
  AccountingConnectionDestroyManyPreQueryHook,
  AccountingConnectionRestoreOnePreQueryHook,
  AccountingConnectionRestoreManyPreQueryHook,
  AccountingConnectionMergeManyPreQueryHook,
];

const guardWithAuthority = (
  authority: 'APPLICATION' | 'SYSTEM' | 'SETTINGS_ROLE' | null,
): AccountingConnectionWriteGuardService =>
  new AccountingConnectionWriteGuardService({
    resolveSettingsAuthority: async () => authority,
  } as unknown as QuotationPermissionService);

describe.each(ACCOUNTING_CONNECTION_HOOKS)('%p', (HookConstructor) => {
  it('refuses an ordinary member before it reaches the database', async () => {
    const hook = new HookConstructor(guardWithAuthority(null));

    await expect(
      hook.execute({ type: 'user' } as never, 'accountingConnection', {
        id: 'connection-1',
        data: { baseUrl: 'https://evil.example.ir' },
      } as never),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });

  it('refuses a settings administrator too: a person never writes this record directly', async () => {
    const hook = new HookConstructor(guardWithAuthority('SETTINGS_ROLE'));

    await expect(
      hook.execute({ type: 'user' } as never, 'accountingConnection', {} as never),
    ).rejects.toBeInstanceOf(QuotationQueryValidationException);
  });

  it('admits the owning application', async () => {
    const hook = new HookConstructor(guardWithAuthority('APPLICATION'));

    await expect(
      hook.execute({ type: 'application' } as never, 'accountingConnection', {
        id: 'connection-1',
      } as never),
    ).resolves.toBeDefined();
  });

  it('admits the platform runtime', async () => {
    const hook = new HookConstructor(guardWithAuthority('SYSTEM'));

    await expect(
      hook.execute({ type: 'system' } as never, 'accountingConnection', {
        id: 'connection-1',
      } as never),
    ).resolves.toBeDefined();
  });
});

describe('AccountingConnectionWriteGuardService message', () => {
  it('names the settings route in Persian and keeps the machine code in the log message', async () => {
    const guard = guardWithAuthority(null);

    await expect(
      guard.assertMachineWriter({ type: 'user' } as never, 'edited'),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });
});
