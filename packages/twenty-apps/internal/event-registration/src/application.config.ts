import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Dedicated configuration layer for the academy workflow.
//
// The generic CRM stays untouched: this app only *uses* existing objects
// (`eventRegistration`, `registrationPayment`) through their normal API and
// adds two record actions plus one shared form. No new object, no new field, no
// schema change, and no funnel or dashboard logic lives here — the dashboard
// keeps recomputing from the same records it always read.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Event Registration',
  description:
    'Record an event registration from a lead or a sales interaction without leaving the record, using the workspace’s existing registration and payment objects.',
  // Explicit empty `serverVariables` is a removal tombstone: the platform only
  // reconciles registration variables when the key is present, so omitting it
  // would leave stale shared rows behind.
  serverVariables: {},
  // No application variables: the API base URL a function uses is a platform
  // concern, configured once per instance through the server's own settings.
  // An empty map removes the earlier app-scoped `TWENTY_API_URL` override, so
  // this app reads the platform value like every other app.
  applicationVariables: {},
});
