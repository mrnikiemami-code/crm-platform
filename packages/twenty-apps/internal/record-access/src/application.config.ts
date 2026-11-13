import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Record-level access for the academy funnel, built entirely on the platform's
// own mechanism: a role whose row-level predicates compare a record's assignee
// with the acting user.
//
// Nothing here re-implements authorisation. The predicates are stored in the
// platform's `rowLevelPermissionPredicate` metadata and enforced by the
// workspace repository, which applies them to every read, write, aggregate and
// joined relation — including the API, exports and logic functions.
//
// The assignment itself lives in an ordinary relation field, so a manager
// assigns or revokes access by editing that field on the record. No new UI and
// no new permission system.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Record Access',
  description:
    'Adds an assignee to persons, event registrations and registration payments, and a role that restricts each member to the records assigned to them.',
  serverVariables: {},
  applicationVariables: {},
});
