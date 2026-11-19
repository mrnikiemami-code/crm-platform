import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DestroyManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

@Injectable()
@WorkspaceQueryHook('quotation.destroyMany')
export class QuotationDestroyManyPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  async execute(): Promise<DestroyManyResolverArgs> {
    throw new QuotationQueryValidationException(
      'quotation.destroyMany is not allowed; destroy one quotation at a time',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
