import { Injectable } from '@nestjs/common';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type RestoreManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPartyWriteGuardService } from 'src/modules/quotation/services/accounting-party-write-guard.service';

@Injectable()
@WorkspaceQueryHook('company.restoreMany')
export class AccountingCompanyRestoreManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(private readonly guard: AccountingPartyWriteGuardService) {}
  async execute(authContext: WorkspaceAuthContext, _objectName: string, payload: RestoreManyResolverArgs): Promise<RestoreManyResolverArgs> {
    await this.guard.assertAllowed(authContext, 'company', 'restoreMany', {});
    return payload;
  }
}
