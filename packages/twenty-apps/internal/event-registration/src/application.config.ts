import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER, RECORD_API_BASE_URL_VARIABLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

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
  // The platform builds every function's `TWENTY_API_URL` from the instance-wide
  // `SERVER_URL` and then spreads the app's workspace variables on top
  // (`logic-function-executor.service.ts`: the `...workspaceVariables` spread is
  // the last entry), so a workspace variable with this exact key replaces it for
  // this app's functions only. Needed because this Dev instance publishes itself
  // on a host port while the container listens elsewhere, which makes the
  // instance-wide URL unreachable from inside the function process.
  //
  // The internal address is a loopback of the container the function runs in,
  // on the port the server actually binds (verified reachable from inside).
  applicationVariables: {
    TWENTY_API_URL: {
      universalIdentifier: RECORD_API_BASE_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
      description:
        'Base URL the app functions use for their own GraphQL calls (reachable from inside the server container).',
      isSecret: false,
      value: 'http://127.0.0.1:3000',
    },
  },
});
