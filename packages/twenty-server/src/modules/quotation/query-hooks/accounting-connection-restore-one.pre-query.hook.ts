import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type RestoreOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingConnectionWriteGuardService } from 'src/modules/quotation/services/accounting-connection-write-guard.service';

@Injectable()
@WorkspaceQueryHook('accountingConnection.restoreOne')
export class AccountingConnectionRestoreOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: AccountingConnectionWriteGuardService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: RestoreOneResolverArgs,
  ): Promise<RestoreOneResolverArgs> {
    await this.writeGuardService.assertMachineWriter(authContext, 'restored');

    return payload;
  }
}
