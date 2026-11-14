import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateManyResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { CustomerOwnershipService } from 'src/modules/record-access/services/customer-ownership.service';

// Bulk create and CSV import take the same path, so the owner is stamped for
// every row, not only the single-record mutation.
@Injectable()
@WorkspaceQueryHook('person.createMany')
export class CustomerOwnerAssignmentCreateManyPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly customerOwnershipService: CustomerOwnershipService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateManyResolverArgs,
  ): Promise<CreateManyResolverArgs> {
    await this.customerOwnershipService.assignOwnerToCreatedCustomers({
      authContext,
      records: payload.data,
    });

    return payload;
  }
}
