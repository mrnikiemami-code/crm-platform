import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DeleteOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationImmutabilityService } from 'src/modules/quotation/services/quotation-immutability.service';

@Injectable()
@WorkspaceQueryHook('quotationLine.deleteOne')
export class QuotationLineDeleteOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly quotationImmutabilityService: QuotationImmutabilityService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: DeleteOneResolverArgs,
  ): Promise<DeleteOneResolverArgs> {
    await this.quotationImmutabilityService.assertQuotationLineMutationAllowedByLineId(
      {
        authContext,
        quotationLineId: payload.id,
      },
    );

    return payload;
  }
}
