import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingConnectionWriteGuardService } from 'src/modules/quotation/services/accounting-connection-write-guard.service';

@Injectable()
@WorkspaceQueryHook('accountingConnection.createMany')
export class AccountingConnectionCreateManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: AccountingConnectionWriteGuardService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateManyResolverArgs,
  ): Promise<CreateManyResolverArgs> {
    await this.writeGuardService.assertMachineWriter(authContext, 'created');

    return payload;
  }
}
