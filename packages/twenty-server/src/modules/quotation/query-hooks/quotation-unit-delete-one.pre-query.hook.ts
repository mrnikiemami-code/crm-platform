import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DeleteOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { QuotationUnitWriteGuardService } from 'src/modules/quotation/services/quotation-unit-write-guard.service';

@Injectable()
@WorkspaceQueryHook('QuotationUnit.deleteOne')
export class QuotationUnitDeleteOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: QuotationUnitWriteGuardService,
  ) {}

  async execute(
    _authContext: WorkspaceAuthContext,
    _objectName: string,
    _payload: DeleteOneResolverArgs<Record<string, unknown>>,
  ): Promise<DeleteOneResolverArgs<Record<string, unknown>>> {
    return this.writeGuardService.refuseWrite('deleted');
  }
}

