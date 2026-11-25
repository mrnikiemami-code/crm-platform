import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationCurrencyCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-create-many.pre-query.hook';
import { QuotationCurrencyCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-create-one.pre-query.hook';
import { QuotationCurrencyDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-delete-many.pre-query.hook';
import { QuotationCurrencyDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-delete-one.pre-query.hook';
import { QuotationCurrencyDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-destroy-many.pre-query.hook';
import { QuotationCurrencyDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-destroy-one.pre-query.hook';
import { QuotationCurrencyMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-merge-many.pre-query.hook';
import { QuotationCurrencyRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-restore-many.pre-query.hook';
import { QuotationCurrencyRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-restore-one.pre-query.hook';
import { QuotationCurrencyUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-update-many.pre-query.hook';
import { QuotationCurrencyUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-currency-update-one.pre-query.hook';
import { QuotationCurrencyWriteGuardService } from 'src/modules/quotation/services/quotation-currency-write-guard.service';

type HookConstructor = new (
  writeGuardService: QuotationCurrencyWriteGuardService,
) => WorkspacePreQueryHookInstance;

const CURRENCY_HOOKS: HookConstructor[] = [
  QuotationCurrencyCreateOnePreQueryHook,
  QuotationCurrencyCreateManyPreQueryHook,
  QuotationCurrencyUpdateOnePreQueryHook,
  QuotationCurrencyUpdateManyPreQueryHook,
  QuotationCurrencyDeleteOnePreQueryHook,
  QuotationCurrencyDeleteManyPreQueryHook,
  QuotationCurrencyDestroyOnePreQueryHook,
  QuotationCurrencyDestroyManyPreQueryHook,
  QuotationCurrencyRestoreOnePreQueryHook,
  QuotationCurrencyRestoreManyPreQueryHook,
  QuotationCurrencyMergeManyPreQueryHook,
];

describe('QuotationCurrencyWriteGuardService', () => {
  it('refuses GraphQL writes with FORBIDDEN', () => {
    const guard = new QuotationCurrencyWriteGuardService();

    try {
      guard.refuseWrite('edited');
      throw new Error('expected the guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationQueryValidationException);
      expect((error as QuotationQueryValidationException).code).toBe(
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
      expect((error as QuotationQueryValidationException).message).toContain(
        'QUOTATION_CURRENCY_WRITE_FORBIDDEN:',
      );
    }
  });
});

describe.each(CURRENCY_HOOKS)('%p', (HookConstructor) => {
  it('blocks the mutation before it reaches the database', async () => {
    const hook = new HookConstructor(new QuotationCurrencyWriteGuardService());

    await expect(
      hook.execute({} as never, 'quotationCurrency', {
        id: 'cur-1',
        data: { accountingCode: 'X' },
      } as never),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });
});
