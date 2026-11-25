import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type UpdateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';
import {
  findClientAccountingSnapshotOverrides,
  stripAccountingSnapshotFields,
} from 'src/modules/quotation/utils/quotation-accounting-snapshot.util';

@Injectable()
@WorkspaceQueryHook('quotation.updateOne')
export class QuotationUpdateOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly quotationImmutabilityService: QuotationImmutabilityService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: UpdateOneResolverArgs<Record<string, unknown>>,
  ): Promise<UpdateOneResolverArgs<Record<string, unknown>>> {
    const rawPatch = payload.data ?? {};

    if (findClientAccountingSnapshotOverrides(rawPatch).length > 0) {
      throw new QuotationQueryValidationException(
        'ACCOUNTING_SNAPSHOT_CLIENT_FORBIDDEN: tax/currency accounting snapshots are server-owned',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const patch = stripAccountingSnapshotFields(rawPatch);
    const observedVersion =
      typeof patch.version === 'number' ? patch.version : null;

    await this.quotationImmutabilityService.assertQuotationUpdateAllowed({
      authContext,
      quotationId: payload.id,
      patch,
    });

    // After the lock token matches, bump version so a concurrent writer fails.
    if (observedVersion !== null) {
      return {
        ...payload,
        data: {
          ...patch,
          version: observedVersion + 1,
        },
      };
    }

    return {
      ...payload,
      data: patch,
    };
  }
}
