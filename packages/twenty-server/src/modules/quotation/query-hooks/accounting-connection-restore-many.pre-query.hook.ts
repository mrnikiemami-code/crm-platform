import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type RestoreManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingConnectionWriteGuardService } from 'src/modules/quotation/services/accounting-connection-write-guard.service';

@Injectable()
@WorkspaceQueryHook('accountingConnection.restoreMany')
export class AccountingConnectionRestoreManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: AccountingConnectionWriteGuardService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: RestoreManyResolverArgs,
  ): Promise<RestoreManyResolverArgs> {
    await this.writeGuardService.assertMachineWriter(authContext, 'restored');

    return payload;
  }
}
