import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type DestroyManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { RoundingRuleWriteGuardService } from 'src/modules/quotation/services/rounding-rule-write-guard.service';

@Injectable()
@WorkspaceQueryHook('roundingRule.destroyMany')
export class RoundingRuleDestroyManyPreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly writeGuardService: RoundingRuleWriteGuardService,
  ) {}

  async execute(
    _authContext: WorkspaceAuthContext,
    _objectName: string,
    _payload: DestroyManyResolverArgs<Record<string, unknown>>,
  ): Promise<DestroyManyResolverArgs<Record<string, unknown>>> {
    return this.writeGuardService.refuseWrite('destroyed');
  }
}
