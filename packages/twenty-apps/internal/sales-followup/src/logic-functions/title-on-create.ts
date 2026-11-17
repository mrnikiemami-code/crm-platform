import { defineLogicFunction } from 'twenty-sdk/define';

import { TITLE_ON_CREATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RecordGraphqlError } from 'src/data/record-graphql';
import { readEventRecordId } from 'src/domain/title-event-payload';
import { syncSalesInteractionTitle } from 'src/services/title-sync';

// Fills the title of a follow-up the moment it is created.
//
// Only an EMPTY title is filled — that is the domain rule, not a check here — so a
// record created with a title already typed keeps it and stays hand-written.
//
// A failure is LOGGED and RETHROWN. The platform's job runner reports a
// non-retryable function error by returning quietly, so the function's own log is
// the only place a rejected read or write becomes visible; swallowing it here (as
// an earlier version did) turned a broken app into a silent no-op.
const handler = async (payload: unknown) => {
  const recordId = readEventRecordId(payload);

  if (recordId === null) {
    console.error('[sales-followup-title-on-create] NO_RECORD_IN_PAYLOAD');

    return { action: 'NO_WRITE', because: 'NO_RECORD_IN_PAYLOAD' };
  }

  try {
    return await syncSalesInteractionTitle({
      recordId,
      titleEditedInThisEvent: false,
    });
  } catch (error) {
    console.error(
      `[sales-followup-title-on-create] failed: ${
        error instanceof RecordGraphqlError
          ? error.message
          : 'UNEXPECTED_FAILURE'
      }`,
    );

    throw error;
  }
};

export default defineLogicFunction({
  universalIdentifier: TITLE_ON_CREATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sales-followup-title-on-create',
  description:
    'Fills an empty sales follow-up title from the call attempt and the customer name, and marks the title automatic.',
  timeoutSeconds: 30,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'salesInteraction.created',
  },
});
