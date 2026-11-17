import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { PERSON_TITLE_SYNC_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  readCustomerName,
  readEventRecordId,
} from 'src/domain/title-event-payload';
import { syncSalesInteractionTitle } from 'src/services/title-sync';

// Keeps titles in step when the CUSTOMER's name changes.
//
// A separate entry point is unavoidable: renaming a Person is an update to
// `person`, which no `salesInteraction` trigger can observe. Watching the two name
// fields keeps the cost proportional to renames.
//
// Safety over completeness: this only ever updates interactions whose ownership
// flag is already automatic, and a read it cannot complete is reported, not
// guessed. If the workspace has many follow-ups per person the run is bounded by
// `RUN_LIMIT`, and the remainder is reported rather than silently skipped.
const WATCHED_FIELDS = ['nameFirstName', 'nameLastName'] as const;
const RUN_LIMIT = 200;

const handler = async (payload: unknown) => {
  const personId = readEventRecordId(payload);

  if (personId === null) {
    return { applied: false, because: 'NO_RECORD_IN_PAYLOAD' };
  }

  const client = new CoreApiClient();

  let interactions: Array<{
    id: string;
    name: string | null;
    callAttempt: string | null;
    titleIsAuto: boolean | null;
  }>;

  try {
    const result = await client.query({
      salesInteractions: {
        __args: {
          first: RUN_LIMIT,
          filter: { eventLead: { personId: { eq: personId } } },
        },
        edges: {
          node: {
            id: true,
            name: true,
            callAttempt: true,
            titleIsAuto: true,
          },
        },
      },
    });

    const edges = (result.salesInteractions as { edges?: unknown } | null)
      ?.edges;

    if (!Array.isArray(edges)) {
      return { applied: false, because: 'UNREADABLE_INTERACTIONS' };
    }

    interactions = edges
      .map((edge) => (edge as { node?: Record<string, unknown> } | null)?.node)
      .filter(
        (node): node is Record<string, unknown> =>
          node !== null && node !== undefined && typeof node['id'] === 'string',
      )
      .map((node) => ({
        id: node['id'] as string,
        name: typeof node['name'] === 'string' ? node['name'] : null,
        callAttempt:
          typeof node['callAttempt'] === 'string' ? node['callAttempt'] : null,
        titleIsAuto:
          typeof node['titleIsAuto'] === 'boolean'
            ? (node['titleIsAuto'] as boolean)
            : null,
      }));
  } catch {
    // Refusing is the safe outcome: an unreadable list must not become "no
    // follow-ups to update" and must not trigger a broad rewrite.
    return { applied: false, because: 'UNREADABLE_INTERACTIONS' };
  }

  if (interactions.length === 0) {
    return { applied: false, because: 'NO_INTERACTIONS' };
  }

  const personResult = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      nameFirstName: true,
      nameLastName: true,
    },
  });

  const customer = readCustomerName(
    (personResult.person as Record<string, unknown> | null) ?? null,
  );

  let updated = 0;
  let skipped = 0;

  for (const interaction of interactions) {
    // Ownership is decided by the sync itself from the stored flag; the name is
    // supplied here because it lives on the person, not on the interaction.
    const result = await syncSalesInteractionTitle({
      client,
      recordId: interaction.id,
      fields: {
        title: interaction.name,
        callAttempt: interaction.callAttempt,
        titleIsAuto: interaction.titleIsAuto,
      },
      // The customer name is read once for the whole run rather than per record.
      customerNameOverride: customer,
    });

    if (result.applied) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    applied: updated > 0,
    updated,
    skipped,
    truncated: interactions.length === RUN_LIMIT,
  };
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
