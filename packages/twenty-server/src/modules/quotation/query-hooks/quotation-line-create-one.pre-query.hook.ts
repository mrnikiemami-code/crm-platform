import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';

@Injectable()
@WorkspaceQueryHook('quotationLine.createOne')
export class QuotationLineCreateOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly quotationImmutabilityService: QuotationImmutabilityService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateOneResolverArgs<Record<string, unknown>>,
  ): Promise<CreateOneResolverArgs<Record<string, unknown>>> {
    // The canonical atomic draft save writes via repository inside the transaction.
    // No generic GraphQL create can bypass unit resolution or the first-use lock.
    await this.quotationImmutabilityService.assertQuotationLineMutationAllowed({ authContext, quotationId: typeof payload.data?.quotationId === 'string' ? payload.data.quotationId : '', validateOnly: true });
    throw new QuotationQueryValidationException('UNIT_MAPPING_REQUIRED: use the canonical draft save to create lines', QuotationQueryValidationExceptionCode.FORBIDDEN);
  }
}
