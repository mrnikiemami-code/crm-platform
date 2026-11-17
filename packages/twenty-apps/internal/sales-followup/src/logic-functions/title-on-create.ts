import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { TITLE_ON_CREATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  readEventRecordId,
  readTitleRecordFields,
} from 'src/domain/title-event-payload';
import { syncSalesInteractionTitle } from 'src/services/title-sync';

// Fills the title of a follow-up the moment it is created.
//
// Only an EMPTY title is filled here — that is the domain rule, not a check in
// this file — so a record created with a title already typed keeps it and is
// recorded as hand-written.
const handler = async (payload: unknown) => {
  const recordId = readEventRecordId(payload);
  const fields = readTitleRecordFields(payload, 'after');

  if (recordId === null || fields === null) {
    // A payload without a record is refused rather than acted on: guessing which
    // record to rename would be worse than doing nothing.
    return { applied: false, because: 'NO_RECORD_IN_PAYLOAD' };
  }

  const client = new CoreApiClient();

  return syncSalesInteractionTitle({ client, recordId, fields });
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
