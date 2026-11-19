import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type RestoreOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

@Injectable()
@WorkspaceQueryHook('quotation.restoreOne')
export class QuotationRestoreOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  async execute(): Promise<RestoreOneResolverArgs> {
    throw new QuotationQueryValidationException(
      'restoring a quotation is not allowed; create a new draft instead',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
