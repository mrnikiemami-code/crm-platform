import {
  defineRole,
  RowLevelPermissionPredicateOperand,
} from 'twenty-sdk/define';

import {
  ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER,
  ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER,
  ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  CALENDAR_EVENT_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER,
  NOTE_TARGET_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
  TASK_TARGET_OBJECT_UNIVERSAL_IDENTIFIER,
  TIMELINE_ACTIVITY_OBJECT_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// ONE role for every restricted member.
//
// The predicate value is "me": at query time the platform resolves it to the
// acting member's own id and renders it as a SQL condition, so the same role
// restricts each member to their own records. That is why there is no role per
// person and nothing to keep in sync when a manager changes an assignment.
//
// LEAST PRIVILEGE, DENY BY DEFAULT. The role-level flags are OFF, so an object
// that is not listed is not reachable. That matters twice over: for a normal
// object the default is already false, but a SYSTEM object defaults to TRUE
// (`workspace-roles-permissions-cache.service.ts`: `overrideValue ?? (isSystem ?
// true : defaultValue)`), so the system objects that carry customer data are
// denied with an explicit `false` below. A new object therefore starts closed for
// this role, which is the point.
//
// The four customer objects keep read+update: the restriction is the ROW, not the
// object, so a member must still be able to work on the records assigned to them.
export default defineRole({
  universalIdentifier: ASSIGNED_RECORDS_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'دسترسی محدود به رکوردهای تخصیصی',
  description:
    'هر عضو فقط اشخاص، سرنخ‌ها، ثبت‌نام‌ها و پرداخت‌هایی را می‌بیند که به خودش تخصیص یافته‌اند.',
  icon: 'IconLockAccess',
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  objectPermissions: [
    // The customer and its funnel: visible row by row through the predicates.
    {
      objectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    // The event catalogue: no customer data, and the registration form needs it
    // to show the event label.
    {
      objectUniversalIdentifier: ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    // Labels for the «مسئول» field.
    {
      objectUniversalIdentifier: WORKSPACE_MEMBER_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    // System objects CARRY customer data and default to open for a system
    // object, so each is denied explicitly rather than left to that default.
    {
      objectUniversalIdentifier: ATTACHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: NOTE_TARGET_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: TASK_TARGET_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: TIMELINE_ACTIVITY_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: CALENDAR_EVENT_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
    {
      objectUniversalIdentifier: MESSAGE_PARTICIPANT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: false,
      canUpdateObjectRecords: false,
    },
  ],
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
    {
      // A sales interaction is the same customer conversation as its lead. Left
      // without a rule it was the widest hole: every restricted member could
      // read every interaction title, which carries the customer's name.
      universalIdentifier: SALES_INTERACTION_ASSIGNEE_PREDICATE_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier:
        SALES_INTERACTION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
      operand: RowLevelPermissionPredicateOperand.IS,
      value: null,
      workspaceMemberFieldUniversalIdentifier:
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
