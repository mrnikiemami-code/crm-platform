import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { TITLE_ON_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  readEventRecordId,
  readTitleRecordFields,
  updatesWatchedField,
} from 'src/domain/title-event-payload';
import { syncSalesInteractionTitle } from 'src/services/title-sync';

// Follows a change to the attempt — or to the title itself — on an existing
// follow-up.
//
// `callAttempt` is watched because the title names the attempt. `name` is watched
// because clearing or editing it decides ownership: an edit turns the title into a
// hand-written one, and the app must then stop following it.
//
// The app's own write also updates `name`, so this function can re-enter. That is
// handled by the domain rule that returns TITLE_UNCHANGED when the stored title
// already matches, so the second pass writes nothing and the chain stops.
const WATCHED_FIELDS = ['callAttempt', 'name'] as const;

const handler = async (payload: unknown) => {
  if (!updatesWatchedField(payload, WATCHED_FIELDS)) {
    return { applied: false, because: 'FIELD_NOT_WATCHED' };
  }

  const recordId = readEventRecordId(payload);
  const fields = readTitleRecordFields(payload, 'after');

  if (recordId === null || fields === null) {
    return { applied: false, because: 'NO_RECORD_IN_PAYLOAD' };
  }

  const client = new CoreApiClient();

  return syncSalesInteractionTitle({ client, recordId, fields });
};

export default defineLogicFunction({
  universalIdentifier: TITLE_ON_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sales-followup-title-on-update',
  description:
    'Keeps an AUTOMATIC sales follow-up title in step with the call attempt, and never touches a hand-written one.',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'salesInteraction.updated',
    updatedFields: [...WATCHED_FIELDS],
  },
});
