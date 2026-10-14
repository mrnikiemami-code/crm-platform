import { defineApplicationRole } from 'twenty-sdk/define';

import {
  DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The role the Communication app's operations run as.
//
// LEAST PRIVILEGE. The role reads and updates records, but it holds NO blanket
// delete permission: `canSoftDeleteAllObjectRecords` and
// `canDestroyAllObjectRecords` are both false at the ROLE level, so Person,
// Company and Communication have no soft-delete or destroy capability at all.
//
// The ONE exception is declared as an explicit per-object override:
// `messageTemplate` may be soft-deleted, which is what lets the SMS Template
// Studio's own Delete work. Hard destroy stays false everywhere, so a mistaken
// template deletion remains recoverable and nothing is ever permanently erased.
//
// Do not add a second object override without the same reasoning: an override is
// only justified when a supported user action in this app requires it.
export default defineApplicationRole({
  universalIdentifier: DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Communication default function role',
  description: 'Role the Communication app operations run as',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  objectPermissions: [
    {
      objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
      canSoftDeleteObjectRecords: true,
    },
  ],
});
