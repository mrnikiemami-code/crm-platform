import { defineApplicationRole } from 'twenty-sdk/define';

import { RECORD_ACCESS_APP_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The identity this application's own operations would run as. It has no logic
// functions, so the role deliberately grants nothing. It is NOT the role that
// restricts people — that one is a normal user role (assigned-records.role.ts)
// so it can be assigned to a workspace member.
export default defineApplicationRole({
  universalIdentifier: RECORD_ACCESS_APP_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Record access app role',
  description: 'Least-privilege identity for the Record Access application',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
});
