import { defineApplicationRole } from 'twenty-sdk/define';

import {
  EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
  SALES_FOLLOWUP_APP_ROLE_UNIVERSAL_IDENTIFIER,
  SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The identity this application's title synchronisation runs as.
//
// LEAST PRIVILEGE, per object: the role-level flags are OFF, so anything not
// listed is unreachable — the platform intersects this role with the operator's,
// and a role with no entry for an object contributes "false" to every operation.
//
// Three objects, and only what each is needed for:
//
//   salesInteraction read + update — read the attempt, the current title and the
//                        ownership flag; update is what authorizes the title
//                        write (the platform maps `insert`/`update` to
//                        `canUpdateObjectRecords`).
//   eventLead          read       — resolve the interaction's customer.
//   person             read       — read that customer's name.
//
// Every other object — and every delete — stays off. This app only ever renames
// a follow-up, so nothing else should be reachable if the code were wrong.
export default defineApplicationRole({
  universalIdentifier: SALES_FOLLOWUP_APP_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Sales follow-up app role',
  description:
    'Reads follow-ups, leads and people, and updates a follow-up title it owns',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: SALES_INTERACTION_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
    },
    {
      objectUniversalIdentifier: EVENT_LEAD_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
    {
      objectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
    },
  ],
});
