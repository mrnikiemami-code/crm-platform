import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DeleteManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationCurrencyWriteGuardService } from 'src/modules/quotation/services/quotation-currency-write-guard.service';

@Injectable()
@WorkspaceQueryHook('quotationCurrency.deleteMany')
export class QuotationCurrencyDeleteManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: QuotationCurrencyWriteGuardService,
  ) {}

  async execute(
    _authContext: WorkspaceAuthContext,
    _objectName: string,
    _payload: DeleteManyResolverArgs<Record<string, unknown>>,
  ): Promise<DeleteManyResolverArgs<Record<string, unknown>>> {
    return this.writeGuardService.refuseWrite('deleted');
  }
}
