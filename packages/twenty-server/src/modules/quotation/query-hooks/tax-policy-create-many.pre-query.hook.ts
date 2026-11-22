import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { TaxPolicyWriteGuardService } from 'src/modules/quotation/services/tax-policy-write-guard.service';

@Injectable()
@WorkspaceQueryHook('taxPolicy.createMany')
export class TaxPolicyCreateManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: TaxPolicyWriteGuardService,
  ) {}

  async execute(
    _authContext: WorkspaceAuthContext,
    _objectName: string,
    _payload: CreateManyResolverArgs<Record<string, unknown>>,
  ): Promise<CreateManyResolverArgs<Record<string, unknown>>> {
    return this.writeGuardService.refuseWrite('created');
  }
}
