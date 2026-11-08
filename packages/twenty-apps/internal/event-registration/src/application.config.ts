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
  serverVariables: {},
});
