import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationRevisionCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-create-many.pre-query.hook';
import { QuotationRevisionCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-create-one.pre-query.hook';
import { QuotationRevisionDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-delete-many.pre-query.hook';
import { QuotationRevisionDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-delete-one.pre-query.hook';
import { QuotationRevisionDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-destroy-many.pre-query.hook';
import { QuotationRevisionDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-destroy-one.pre-query.hook';
import { QuotationRevisionRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-restore-many.pre-query.hook';
import { QuotationRevisionRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-restore-one.pre-query.hook';
import { QuotationRevisionUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-update-many.pre-query.hook';
import { QuotationRevisionUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-revision-update-one.pre-query.hook';
import { QuotationRevisionWriteGuardService } from 'src/modules/quotation/services/quotation-revision-write-guard.service';

type RevisionHookConstructor = new (
  writeGuardService: QuotationRevisionWriteGuardService,
) => WorkspacePreQueryHookInstance;

// Every public mutation route must be covered: a single unguarded one lets an
// operator rewrite history that the issued PDF and the accounting export rely on.
const REVISION_HOOKS: RevisionHookConstructor[] = [
  QuotationRevisionCreateOnePreQueryHook,
  QuotationRevisionCreateManyPreQueryHook,
  QuotationRevisionUpdateOnePreQueryHook,
  QuotationRevisionUpdateManyPreQueryHook,
  QuotationRevisionDeleteOnePreQueryHook,
  QuotationRevisionDeleteManyPreQueryHook,
  QuotationRevisionDestroyOnePreQueryHook,
  QuotationRevisionDestroyManyPreQueryHook,
  QuotationRevisionRestoreOnePreQueryHook,
  QuotationRevisionRestoreManyPreQueryHook,
];

describe('QuotationRevisionWriteGuardService', () => {
  it('refuses with FORBIDDEN and a Persian operator message', () => {
    const guard = new QuotationRevisionWriteGuardService();

    try {
      guard.refuseWrite('edited');
      throw new Error('expected the guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationQueryValidationException);

      const exception = error as QuotationQueryValidationException;

      expect(exception.code).toBe(
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
      expect(exception.message).toContain('REVISION_IMMUTABLE:');
      expect(exception.userFriendlyMessage.message).toContain(
        'نسخهٔ صادرشدهٔ پیش‌فاکتور مهروموم شده',
      );
      expect(exception.userFriendlyMessage.message).not.toContain(
        'REVISION_IMMUTABLE',
      );
    }
  });
});

describe.each(REVISION_HOOKS)('%p', (HookConstructor) => {
  it('blocks the mutation before it reaches the database', async () => {
    const hook = new HookConstructor(new QuotationRevisionWriteGuardService());

    await expect(
      hook.execute({} as never, 'quotationRevision', {
        id: 'revision-1',
        data: { total: '999.00' },
      } as never),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });
});
