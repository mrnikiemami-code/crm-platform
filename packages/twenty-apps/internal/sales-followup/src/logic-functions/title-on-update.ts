import { defineLogicFunction } from 'twenty-sdk/define';

import { TITLE_ON_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RecordGraphqlError } from 'src/data/record-graphql';
import {
  readEventRecordId,
  updatesWatchedField,
} from 'src/domain/title-event-payload';
import { syncSalesInteractionTitle } from 'src/services/title-sync';

// Follows a change to the attempt — or to the title itself — on an existing
// follow-up.
//
// `callAttempt` is watched because the title names the attempt. `name` is watched
// because a change to it decides OWNERSHIP: if the new text is not what this app
// would have produced, a person typed it and ownership is released.
//
// Whether `name` was part of THIS event is the discriminator, and it is read from
// the event's own `updatedFields` rather than inferred from the text. That is what
// lets the app's own write be recognised as its own (the resulting title equals
// the computed one, so nothing happens) while a genuine edit releases ownership.
//
// The app's write also updates `name`, so this function can re-enter; the
// "already correct" rule makes the second pass a no-op and the chain stops.
const WATCHED_FIELDS = ['callAttempt', 'name'] as const;

const handler = async (payload: unknown) => {
  if (!updatesWatchedField(payload, WATCHED_FIELDS)) {
    return { action: 'NO_WRITE', because: 'FIELD_NOT_WATCHED' };
  }

  const recordId = readEventRecordId(payload);

  if (recordId === null) {
    console.error('[sales-followup-title-on-update] NO_RECORD_IN_PAYLOAD');

    return { action: 'NO_WRITE', because: 'NO_RECORD_IN_PAYLOAD' };
  }

  try {
    return await syncSalesInteractionTitle({
      recordId,
      titleEditedInThisEvent: updatesWatchedField(payload, ['name']),
    });
  } catch (error) {
    console.error(
      `[sales-followup-title-on-update] failed: ${
        error instanceof RecordGraphqlError
          ? error.message
          : 'UNEXPECTED_FAILURE'
      }`,
    );

    throw error;
  }
};

export default defineLogicFunction({
  universalIdentifier: TITLE_ON_UPDATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sales-followup-title-on-update',
  description:
    'Keeps an AUTOMATIC sales follow-up title in step with the call attempt, and releases ownership the moment a person edits the title.',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'salesInteraction.updated',
    updatedFields: [...WATCHED_FIELDS],
  },
});
