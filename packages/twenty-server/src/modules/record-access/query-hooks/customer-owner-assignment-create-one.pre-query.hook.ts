import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type CreateOneResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { CustomerOwnershipService } from 'src/modules/record-access/services/customer-ownership.service';

// A restricted member's new customer is theirs, decided here and not by the
// browser: the row-level rule compares this column with the acting member, so a
// customer created without it would be invisible to the very person who
// registered it, and one created pointing at a colleague would hand them a
// customer the creator never owned.
@Injectable()
@WorkspaceQueryHook('person.createOne')
export class CustomerOwnerAssignmentCreateOnePreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    private readonly customerOwnershipService: CustomerOwnershipService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateOneResolverArgs,
  ): Promise<CreateOneResolverArgs> {
    await this.customerOwnershipService.assignOwnerToCreatedCustomers({
      authContext,
      records: [payload.data],
    });

    return payload;
  }
}
