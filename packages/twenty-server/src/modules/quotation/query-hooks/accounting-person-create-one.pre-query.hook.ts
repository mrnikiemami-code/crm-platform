import { Injectable } from '@nestjs/common';
import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { AccountingPartyWriteGuardService } from 'src/modules/quotation/services/accounting-party-write-guard.service';

@Injectable()
@WorkspaceQueryHook('person.createOne')
export class AccountingPersonCreateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(private readonly guard: AccountingPartyWriteGuardService) {}
  async execute(authContext: WorkspaceAuthContext, _objectName: string, payload: CreateOneResolverArgs): Promise<CreateOneResolverArgs> {
    await this.guard.assertAllowed(authContext, 'person', 'createOne', payload);
    return payload;
  }
}
