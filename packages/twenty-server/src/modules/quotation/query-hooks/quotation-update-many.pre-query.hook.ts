import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type UpdateManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

// Batch updates would skip per-row freeze checks unless each id is loaded; refuse
// the whole operation so callers use updateOne (which is gated).
@Injectable()
@WorkspaceQueryHook('quotation.updateMany')
export class QuotationUpdateManyPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  async execute(): Promise<UpdateManyResolverArgs> {
    throw new QuotationQueryValidationException(
      'quotation.updateMany is not allowed; update one quotation at a time',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
