import { Module } from '@nestjs/common';

import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { CustomerOwnerAssignmentCreateManyPreQueryHook } from 'src/modules/record-access/query-hooks/customer-owner-assignment-create-many.pre-query.hook';
import { CustomerOwnerAssignmentCreateOnePreQueryHook } from 'src/modules/record-access/query-hooks/customer-owner-assignment-create-one.pre-query.hook';
import {
  EventLeadOwnerAssignmentCreateManyPreQueryHook,
  EventLeadOwnerAssignmentCreateOnePreQueryHook,
  EventRegistrationOwnerAssignmentCreateManyPreQueryHook,
  EventRegistrationOwnerAssignmentCreateOnePreQueryHook,
  RegistrationPaymentOwnerAssignmentCreateManyPreQueryHook,
  RegistrationPaymentOwnerAssignmentCreateOnePreQueryHook,
  SalesInteractionOwnerAssignmentCreateManyPreQueryHook,
  SalesInteractionOwnerAssignmentCreateOnePreQueryHook,
} from 'src/modules/record-access/query-hooks/dependent-owner-assignment.pre-query.hooks';
import { CustomerOwnershipService } from 'src/modules/record-access/services/customer-ownership.service';

@Module({
  imports: [WorkspaceCacheModule],
  providers: [
    CustomerOwnershipService,
    CustomerOwnerAssignmentCreateOnePreQueryHook,
    CustomerOwnerAssignmentCreateManyPreQueryHook,
    EventLeadOwnerAssignmentCreateOnePreQueryHook,
    EventLeadOwnerAssignmentCreateManyPreQueryHook,
    EventRegistrationOwnerAssignmentCreateOnePreQueryHook,
    EventRegistrationOwnerAssignmentCreateManyPreQueryHook,
    RegistrationPaymentOwnerAssignmentCreateOnePreQueryHook,
    RegistrationPaymentOwnerAssignmentCreateManyPreQueryHook,
    SalesInteractionOwnerAssignmentCreateOnePreQueryHook,
    SalesInteractionOwnerAssignmentCreateManyPreQueryHook,
  ],
})
export class RecordAccessQueryHookModule {}
