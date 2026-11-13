import {
  defineRole,
  RowLevelPermissionPredicateOperand,
} from 'twenty-sdk/define';

import {
  ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// ONE role for every restricted member.
//
// The predicate value is "me": at query time the platform resolves it to the
// acting member's own id and renders it as a SQL condition, so the same role
// restricts each member to their own records. That is why there is no role per
// person and nothing to keep in sync when a manager changes an assignment.
//
// Object-level rights are deliberately the same as an ordinary member's: the
// restriction is the ROW, not the object. Narrowing the object would make an
// assigned person unreadable and break the workflow instead of scoping it.
//
// The four predicates cover the paths a restricted member could otherwise use:
// the person list, the leads list (a lead names its person), the registrations
// list and the payments list. Joined reads are policy-checked as well, so a
// lead cannot be read indirectly through a registration.
export default defineRole({
  universalIdentifier: ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'دسترسی محدود به رکوردهای تخصیصی',
  description:
    'هر عضو فقط اشخاص، سرنخ‌ها، ثبت‌نام‌ها و پرداخت‌هایی را می‌بیند که به خودش تخصیص یافته‌اند.',
  icon: 'IconLockAccess',
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  rowLevelPermissionPredicates: [
    {
      universalIdentifier: PERSON_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier: PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: null,
      workspaceMemberFieldUniversalIdentifier:
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: EVENT_LEAD_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
      // The lead's own existing assignment field, not a new one.
      fieldUniversalIdentifier:
        EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: null,
      workspaceMemberFieldUniversalIdentifier:
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier:
        EVENT_REGISTRATION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier:
        EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: null,
      workspaceMemberFieldUniversalIdentifier:
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier:
        REGISTRATION_PAYMENT_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier:
        REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: null,
      workspaceMemberFieldUniversalIdentifier:
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
