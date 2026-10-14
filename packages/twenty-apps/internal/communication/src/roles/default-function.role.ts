import { defineApplicationRole } from 'twenty-sdk/define';

import { DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineApplicationRole({
  universalIdentifier: DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Communication default function role',
  description: 'Role the Communication app operations run as',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  // REQUIRED by the SMS Template Studio: deleting a template through the studio's
  // own route is a supported user action, and the platform authorizes it through
  // this role. Without soft delete the app's own delete always failed with a
  // sanitized error while the row stayed in place. Hard destroy stays DENIED —
  // the studio soft-deletes, which is the platform's normal delete, and a
  // mistaken deletion remains recoverable.
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
});
