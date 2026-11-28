import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationUnitCreateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-create-many.pre-query.hook';
import { QuotationUnitCreateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-create-one.pre-query.hook';
import { QuotationUnitDeleteManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-delete-many.pre-query.hook';
import { QuotationUnitDeleteOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-delete-one.pre-query.hook';
import { QuotationUnitDestroyManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-destroy-many.pre-query.hook';
import { QuotationUnitDestroyOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-destroy-one.pre-query.hook';
import { QuotationUnitMergeManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-merge-many.pre-query.hook';
import { QuotationUnitRestoreManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-restore-many.pre-query.hook';
import { QuotationUnitRestoreOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-restore-one.pre-query.hook';
import { QuotationUnitUpdateManyPreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-update-many.pre-query.hook';
import { QuotationUnitUpdateOnePreQueryHook } from 'src/modules/quotation/query-hooks/quotation-unit-update-one.pre-query.hook';
import { QuotationUnitWriteGuardService } from 'src/modules/quotation/services/quotation-unit-write-guard.service';

type HookConstructor = new (
  writeGuardService: QuotationUnitWriteGuardService,
) => WorkspacePreQueryHookInstance;

const UNIT_HOOKS: HookConstructor[] = [
  QuotationUnitCreateOnePreQueryHook,
  QuotationUnitCreateManyPreQueryHook,
  QuotationUnitUpdateOnePreQueryHook,
  QuotationUnitUpdateManyPreQueryHook,
  QuotationUnitDeleteOnePreQueryHook,
  QuotationUnitDeleteManyPreQueryHook,
  QuotationUnitDestroyOnePreQueryHook,
  QuotationUnitDestroyManyPreQueryHook,
  QuotationUnitRestoreOnePreQueryHook,
  QuotationUnitRestoreManyPreQueryHook,
  QuotationUnitMergeManyPreQueryHook,
];

describe('QuotationUnitWriteGuardService', () => {
  it('refuses GraphQL writes with FORBIDDEN', () => {
    const guard = new QuotationUnitWriteGuardService();

    try {
      guard.refuseWrite('edited');
      throw new Error('expected the guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(QuotationQueryValidationException);
      expect((error as QuotationQueryValidationException).code).toBe(
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
      expect((error as QuotationQueryValidationException).message).toContain(
        'QUOTATION_UNIT_WRITE_FORBIDDEN:',
      );
    }
  });
});

describe.each(UNIT_HOOKS)('%p', (HookConstructor) => {
  it('blocks the mutation before it reaches the database', async () => {
    const hook = new HookConstructor(new QuotationUnitWriteGuardService());

    await expect(
      hook.execute({} as never, 'QuotationUnit', {
        id: 'cur-1',
        data: { accountingCode: 'X' },
      } as never),
    ).rejects.toMatchObject({
      code: QuotationQueryValidationExceptionCode.FORBIDDEN,
    });
  });
});

