import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { TaxPolicyCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-create-many.pre-query.hook';
import { TaxPolicyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-create-one.pre-query.hook';
import { TaxPolicyDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-delete-many.pre-query.hook';
import { TaxPolicyDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-delete-one.pre-query.hook';
import { TaxPolicyDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-destroy-many.pre-query.hook';
import { TaxPolicyDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-destroy-one.pre-query.hook';
import { TaxPolicyMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-merge-many.pre-query.hook';
import { TaxPolicyRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-restore-many.pre-query.hook';
import { TaxPolicyRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-restore-one.pre-query.hook';
import { TaxPolicyUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-update-many.pre-query.hook';
import { TaxPolicyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/tax-policy-update-one.pre-query.hook';
import { TaxPolicyWriteGuardService } from 'src/modules/quotation/services/tax-policy-write-guard.service';

type TaxPolicyHookConstructor = new (
  writeGuardService: TaxPolicyWriteGuardService,
) => WorkspacePreQueryHookInstance;

// Every generated mutation on the object must be listed. A missing one is a bypass:
// the platform builds these resolvers for any workspace object, so the only thing
// standing between an admin token and a rewritten rate is this hook set.
const TAX_POLICY_HOOKS: TaxPolicyHookConstructor[] = [
  TaxPolicyCreateOnePreQueryHook,
  TaxPolicyCreateManyPreQueryHook,
  TaxPolicyUpdateOnePreQueryHook,
  TaxPolicyUpdateManyPreQueryHook,
  TaxPolicyDeleteOnePreQueryHook,
  TaxPolicyDeleteManyPreQueryHook,
  TaxPolicyDestroyOnePreQueryHook,
  TaxPolicyDestroyManyPreQueryHook,
  TaxPolicyRestoreOnePreQueryHook,
  TaxPolicyRestoreManyPreQueryHook,
  TaxPolicyMergeManyPreQueryHook,
];

describe('TaxPolicyWriteGuardService', () => {
  it('refuses with FORBIDDEN and a Persian message that names the allowed route', () => {
    const guard = new TaxPolicyWriteGuardService();

    try {
      guard.refuseWrite('edited');
      throw new Error('expected the guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationQueryValidationException);

      const exception = error as QuotationQueryValidationException;

      expect(exception.code).toBe(
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
      // The English message keeps the machine code; the toast is Persian.
      expect(exception.message).toContain('TAX_POLICY_WRITE_FORBIDDEN:');
      expect(exception.userFriendlyMessage.message).toContain(
        'سیاست مالیات',
      );
      expect(exception.userFriendlyMessage.message).not.toContain(
        'TAX_POLICY_WRITE_FORBIDDEN',
      );
    }
  });
});

describe.each(TAX_POLICY_HOOKS)('%p', (HookConstructor) => {
  it('blocks the mutation before it reaches the database', async () => {
    const hook = new HookConstructor(new TaxPolicyWriteGuardService());

    await expect(
      hook.execute({} as never, 'taxPolicy', {
        id: 'policy-1',
        data: { rateBasisPoints: '0', isDefault: true },
      } as never),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });
});
