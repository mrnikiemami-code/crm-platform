import {
  executeRecordGraphql,
  readConnectionNodes,
  RecordGraphqlError,
} from 'src/data/record-graphql';
import {
  decideSalesInteractionTitle,
  type SalesInteractionTitleDecision,
  type SalesInteractionTitleState,
} from 'src/domain/sales-interaction-title';

// Bringing one follow-up's title in line with its facts, exactly once.
//
// Every read goes through the workspace record API with this app's own token, and
// a rejected read or write is THROWN rather than folded into "nothing to do": a
// silent failure here is what made an earlier version report a completed job
// while writing nothing at all.

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

/**
 * A person's name.
 *
 * `name` is a COMPOSITE field on this workspace: `nameFirstName` exists in the
 * database but NOT in GraphQL, where it reads back as a null column. Asking for
 * the flat names returns nulls, which is why a customer silently became
 * «مشتری بدون نام».
 */
const readPersonName = async (
  personId: string,
): Promise<{ firstName: string | null; lastName: string | null }> => {
  const data = await executeRecordGraphql({
    phase: 'READ_PERSON',
    query: `query PersonName($id: UUID!) {
      person(filter: { id: { eq: $id } }) { id name { firstName lastName } }
    }`,
    variables: { id: personId },
  });

  const person = asRecord(data['person']);
  const composite = asRecord(person?.['name']);

  return {
    firstName: asText(composite?.['firstName']),
    lastName: asText(composite?.['lastName']),
  };
};

const readPersonIdForLead = async (
  eventLeadId: string,
): Promise<string | null> => {
  const data = await executeRecordGraphql({
    phase: 'READ_LEAD',
    query: `query LeadPerson($id: UUID!) {
      eventLead(filter: { id: { eq: $id } }) { id personId }
    }`,
    variables: { id: eventLeadId },
  });

  return asText(asRecord(data['eventLead'])?.['personId']);
};

const readInteraction = async (
  recordId: string,
): Promise<{
  name: string | null;
  callAttempt: string | null;
  titleIsAuto: boolean | null;
  eventLeadId: string | null;
}> => {
  const data = await executeRecordGraphql({
    phase: 'READ_INTERACTION',
    query: `query Interaction($id: UUID!) {
      salesInteraction(filter: { id: { eq: $id } }) {
        id name callAttempt titleIsAuto eventLeadId
      }
    }`,
    variables: { id: recordId },
  });

  const interaction = asRecord(data['salesInteraction']);

  if (interaction === null) {
    throw new RecordGraphqlError('READ_INTERACTION', 'NO_DATA');
  }

  return {
    name: asText(interaction['name']),
    callAttempt: asText(interaction['callAttempt']),
    titleIsAuto: asBoolean(interaction['titleIsAuto']),
    eventLeadId: asText(interaction['eventLeadId']),
  };
};

/** Title and ownership are written together, never separately. */
const writeTitle = async ({
  recordId,
  title,
  titleIsAuto,
}: {
  recordId: string;
  title?: string;
  titleIsAuto: boolean;
}): Promise<void> => {
  await executeRecordGraphql({
    phase: 'WRITE_TITLE',
    query: `mutation SetTitle($id: UUID!, $data: SalesInteractionUpdateInput!) {
      updateSalesInteraction(id: $id, data: $data) { id }
    }`,
    variables: {
      id: recordId,
      // `name` is omitted when only ownership changes: a manual title must never
      // be rewritten by the act of releasing it.
      data: title === undefined ? { titleIsAuto } : { name: title, titleIsAuto },
    },
  });
};

export type SyncTitleResult = {
  action: SalesInteractionTitleDecision['kind'];
  because: string;
  title?: string;
};

/**
 * Resolves and applies the decision for one interaction.
 *
 * Facts are ALWAYS re-read from the database rather than taken from the event
 * payload: the payload shows the record as it was mid-write, and a customer name
 * obtained from a nested read of that snapshot is unreliable on this server.
 */
export const syncSalesInteractionTitle = async ({
  recordId,
  titleEditedInThisEvent,
  customerName,
}: {
  recordId: string;
  /** True when this event's `updatedFields` contains `name`. */
  titleEditedInThisEvent: boolean;
  /** Supplied by a bulk caller that already read the customer once. */
  customerName?: { firstName: string | null; lastName: string | null };
}): Promise<SyncTitleResult> => {
  const interaction = await readInteraction(recordId);

  const personId =
    interaction.eventLeadId === null
      ? null
      : await readPersonIdForLead(interaction.eventLeadId);

  const name =
    customerName ??
    (personId === null
      ? { firstName: null, lastName: null }
      : await readPersonName(personId));

  const state: SalesInteractionTitleState = {
    callAttempt: interaction.callAttempt,
    customerFirstName: name.firstName,
    customerLastName: name.lastName,
    title: interaction.name,
    titleIsAuto: interaction.titleIsAuto,
  };

  const decision = decideSalesInteractionTitle({
    state,
    titleEditedInThisEvent,
  });

  if (decision.kind === 'WRITE_TITLE') {
    await writeTitle({
      recordId,
      title: decision.title,
      titleIsAuto: decision.titleIsAuto,
    });

    return { action: decision.kind, because: decision.because, title: decision.title };
  }

  if (decision.kind === 'RELEASE_OWNERSHIP') {
    await writeTitle({ recordId, titleIsAuto: decision.titleIsAuto });

    return { action: decision.kind, because: decision.because };
  }

  return { action: decision.kind, because: decision.because };
};

/**
 * Interactions whose customer is this person.
 *
 * Two steps because the app token's schema cannot traverse
 * `salesInteraction.eventLead.personId` in a filter reliably: leads are listed by
 * `personId` first, then interactions by those lead ids.
 */
export const findInteractionIdsForPerson = async (
  personId: string,
  limit: number,
): Promise<string[]> => {
  const leadsData = await executeRecordGraphql({
    phase: 'LIST_LEADS',
    query: `query LeadsOfPerson($personId: UUID!, $first: Int!) {
      eventLeads(first: $first, filter: { personId: { eq: $personId } }) {
        edges { node { id } }
      }
    }`,
    variables: { personId, first: limit },
  });

  const leadIds = readConnectionNodes(leadsData['eventLeads'])
    .map((node) => asText(node['id']))
    .filter((id): id is string => id !== null);

  if (leadIds.length === 0) {
    return [];
  }

  const interactionsData = await executeRecordGraphql({
    phase: 'LIST_INTERACTIONS',
    query: `query InteractionsOfLeads($leadIds: [UUID!], $first: Int!) {
      salesInteractions(first: $first, filter: { eventLeadId: { in: $leadIds } }) {
        edges { node { id } }
      }
    }`,
    variables: { leadIds, first: limit },
  });

  return readConnectionNodes(interactionsData['salesInteractions'])
    .map((node) => asText(node['id']))
    .filter((id): id is string => id !== null);
};
