import { Injectable } from '@nestjs/common';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type UpdateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPartyWriteGuardService } from 'src/modules/quotation/services/accounting-party-write-guard.service';

@Injectable()
@WorkspaceQueryHook('company.updateOne')
export class AccountingCompanyUpdateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(private readonly guard: AccountingPartyWriteGuardService) {}
  async execute(authContext: WorkspaceAuthContext, _objectName: string, payload: UpdateOneResolverArgs): Promise<UpdateOneResolverArgs> {
    await this.guard.assertAllowed(authContext, 'company', 'updateOne', payload);
    return payload;
  }
}
