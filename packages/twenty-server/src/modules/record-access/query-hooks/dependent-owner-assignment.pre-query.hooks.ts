import { Injectable } from '@nestjs/common';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import { type ResolverArgs } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { CustomerOwnershipService } from 'src/modules/record-access/services/customer-ownership.service';

/**
 * Stamps the owner on a dependent record created for a customer the acting
 * member owns.
 *
 * One hook per object and method, because the platform keys a hook on
 * `object.method`. They all do the same thing: the object name arrives as an
 * argument, so the only per-class difference is the key it is registered under.
 *
 * The payload is either a single `data` object or a `data` array (bulk create
 * and CSV import), which is the only shape difference to absorb.
 */
abstract class DependentOwnerAssignmentPreQueryHook
  implements WorkspacePreQueryHookInstance
{
  constructor(
    protected readonly customerOwnershipService: CustomerOwnershipService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    objectName: string,
    payload: ResolverArgs,
  ): Promise<ResolverArgs> {
    const data = (payload as { data?: unknown }).data;

    const records = Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : data !== null && typeof data === 'object'
        ? [data as Record<string, unknown>]
        : [];

    await this.customerOwnershipService.assignOwnerToCreatedDependents({
      authContext,
      objectNameSingular: objectName,
      records,
    });

    return payload;
  }
}

@Injectable()
@WorkspaceQueryHook('eventLead.createOne')
export class EventLeadOwnerAssignmentCreateOnePreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('eventLead.createMany')
export class EventLeadOwnerAssignmentCreateManyPreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('eventRegistration.createOne')
export class EventRegistrationOwnerAssignmentCreateOnePreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('eventRegistration.createMany')
export class EventRegistrationOwnerAssignmentCreateManyPreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('registrationPayment.createOne')
export class RegistrationPaymentOwnerAssignmentCreateOnePreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('registrationPayment.createMany')
export class RegistrationPaymentOwnerAssignmentCreateManyPreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('salesInteraction.createOne')
export class SalesInteractionOwnerAssignmentCreateOnePreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}

@Injectable()
@WorkspaceQueryHook('salesInteraction.createMany')
export class SalesInteractionOwnerAssignmentCreateManyPreQueryHook extends DependentOwnerAssignmentPreQueryHook {
  constructor(service: CustomerOwnershipService) {
    super(service);
  }
}
