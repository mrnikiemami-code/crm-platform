import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DeleteManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';

@Injectable()
@WorkspaceQueryHook('quotationLine.deleteMany')
export class QuotationLineDeleteManyPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  async execute(): Promise<DeleteManyResolverArgs> {
    throw new QuotationQueryValidationException(
      'quotationLine.deleteMany is not allowed; delete one line at a time',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}
