import { defineLogicFunction } from 'twenty-sdk/define';

import { PERSON_TITLE_SYNC_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RecordGraphqlError } from 'src/data/record-graphql';
import { readEventRecordId } from 'src/domain/title-event-payload';
import {
  findInteractionIdsForPerson,
  syncSalesInteractionTitle,
} from 'src/services/title-sync';

// Keeps titles in step when the CUSTOMER's name changes.
//
// A separate entry point is unavoidable: renaming a Person is an update to
// `person`, which no `salesInteraction` trigger can observe.
//
// The watched field is `name`, not `nameFirstName`/`nameLastName`: the workspace
// declares one COMPOSITE field for a person's name, and the platform reports the
// change as `name`. Watching the flat columns matched nothing, so a rename never
// fired — verified against the event payload on Dev, which carried
// `updatedFields: ["name", "updatedBy"]`.
//
// `titleEditedInThisEvent` is false here on purpose: this event is about the
// PERSON, so a title that differs from the computed one was not edited by the
// person who renamed the customer — it is either an automatic title that needs to
// follow, or a manual one that must stay.
const WATCHED_FIELDS = ['name'] as const;

// Bounded so one rename cannot fan out without limit; the remainder is reported
// rather than silently skipped.
const RUN_LIMIT = 200;

const handler = async (payload: unknown) => {
  const personId = readEventRecordId(payload);

  if (personId === null) {
    console.error('[sales-followup-title-on-person-rename] NO_RECORD_IN_PAYLOAD');

    return { action: 'NO_WRITE', because: 'NO_RECORD_IN_PAYLOAD' };
  }

  try {
    const interactionIds = await findInteractionIdsForPerson(
      personId,
      RUN_LIMIT,
    );

    if (interactionIds.length === 0) {
      return { action: 'NO_WRITE', because: 'NO_INTERACTIONS' };
    }

    let written = 0;
    let released = 0;
    let untouched = 0;

    for (const recordId of interactionIds) {
      const result = await syncSalesInteractionTitle({
        recordId,
        titleEditedInThisEvent: false,
      });

      if (result.action === 'WRITE_TITLE') {
        written += 1;
      } else if (result.action === 'RELEASE_OWNERSHIP') {
        released += 1;
      } else {
        untouched += 1;
      }
    }

    return {
      action: written > 0 ? 'WRITE_TITLE' : 'NO_WRITE',
      written,
      released,
      untouched,
      truncated: interactionIds.length === RUN_LIMIT,
    };
  } catch (error) {
    console.error(
      `[sales-followup-title-on-person-rename] failed: ${
        error instanceof RecordGraphqlError
          ? error.message
          : 'UNEXPECTED_FAILURE'
      }`,
    );

    throw error;
  }
};

export default defineLogicFunction({
  universalIdentifier: PERSON_TITLE_SYNC_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'sales-followup-title-on-person-rename',
  description:
    'Updates AUTOMATIC sales follow-up titles when the customer name changes. Hand-written titles are never touched.',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'person.updated',
    updatedFields: [...WATCHED_FIELDS],
  },
});
