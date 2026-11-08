import { defineApplicationRole } from 'twenty-sdk/define';

import { REGISTRATION_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The role the app's two server functions run as.
//
// `canUpdateAllObjectRecords` is what authorizes CREATE as well as UPDATE:
// Twenty's ORM maps `insert` to `canUpdateObjectRecords`
// (`is-object-operation-permitted.util.ts`), so no extra create flag exists or
// is needed. Deletes stay off entirely — this feature never removes a record,
// and a mistaken click must remain recoverable in the workspace's own UI.
export default defineApplicationRole({
  universalIdentifier: REGISTRATION_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Event registration function role',
  description:
    'Reads leads, interactions, registrations and payments and creates registrations with their payments',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
