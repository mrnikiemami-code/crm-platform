import { defineApplicationRole } from 'twenty-sdk/define';

import {
  ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER,
  EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  REGISTRATION_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The role the app's two server functions run as.
//
// LEAST PRIVILEGE, per object. The role-level flags are OFF, so an object that
// is not listed below is not reachable at all: the platform computes the
// operator's effective permission as the INTERSECTION of this role and the
// operator's own role (`resolve-role-ids-for-user.util.ts`,
// `compute-permission-intersection.util.ts`), and a role with no entry for an
// object contributes "false" for every operation on it.
//
// Six objects, and only what each is needed for:
//
//   eventLead        read   — resolve the lead a registration belongs to, and
//                             read its person/event for the prefill.
//   salesInteraction read   — resolve that lead when the form is opened from an
//                             interaction, and read `performedBy` for
//                             attribution. Never written: its history stays.
//   person           read   — the lead's `person` relation is traversed for the
//                             id, so the read must be authorized too.
//   academyEvent     read   — same, for the lead's `academyEvent` relation.
//   eventRegistration read + update — update is what authorizes CREATE
//                             (`is-object-operation-permitted.util.ts` maps
//                             `insert` to `canUpdateObjectRecords`); read is the
//                             duplicate check.
//   registrationPayment read + update — create only, when money was received.
//                             Read is needed too: field-level write permission
//                             is derived from the readable fields.
//
// Deletes stay off everywhere: this feature never removes a record, and a wrong
// click must stay recoverable in the workspace's own UI.
export default defineApplicationRole({
  universalIdentifier: REGISTRATION_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Event registration function role',
  description:
    'Reads leads, interactions, people and events, and creates event registrations with their payments',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: ACADEMY_EVENT_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: EVENT_REGISTRATION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier:
        REGISTRATION_PAYMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      // Read is required as well as update: the platform authorizes setting a
      // field against the role's field-level permissions, which it derives from
      // the readable fields. Without read, creating a payment is refused with
      // "does not have permission" even though update is granted.
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
  ],
});
