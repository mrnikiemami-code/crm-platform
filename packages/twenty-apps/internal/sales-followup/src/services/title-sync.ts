import { type CoreApiClient } from 'twenty-client-sdk/core';

import { decideSalesInteractionTitle } from 'src/domain/sales-interaction-title';
import {
  readCustomerName,
  readEventRecordId,
  readRelationIds,
  readTitleRecordFields,
  type TitleRecordFields,
} from 'src/domain/title-event-payload';

// Reading and writing through the app's own scoped client. No raw SQL, no core
// repository, no cross-app import: this is the documented way an app touches its
// workspace's records.
type QueryClient = Pick<CoreApiClient, 'query'>;
type MutationClient = Pick<CoreApiClient, 'mutation'>;

/**
 * The customer's name for one interaction.
 *
 * Walked in steps (interaction → eventLead → person) rather than as one nested
 * read, because a two-level nested read on this server returns null even for rows
 * that have values — which would silently turn every customer into «مشتری بدون
 * نام». Each step is a separate, complete read.
 *
 * A missing link yields "no name" rather than an error: a follow-up whose lead or
 * person was removed still deserves a readable title.
 */
const findCustomerName = async ({
  client,
  eventLeadId,
}: {
  client: QueryClient;
  eventLeadId: string | null;
}): Promise<{ firstName: string | null; lastName: string | null }> => {
  if (eventLeadId === null) {
    return { firstName: null, lastName: null };
  }

  let personId: string | null = null;

  try {
    const leadResult = await client.query({
      eventLead: {
        __args: { filter: { id: { eq: eventLeadId } } },
        personId: true,
      },
    });

    const lead = leadResult.eventLead as
      | { personId?: unknown }
      | null
      | undefined;

    personId =
      typeof lead?.personId === 'string' && lead.personId.length > 0
        ? lead.personId
        : null;
  } catch {
    return { firstName: null, lastName: null };
  }

  if (personId === null) {
    return { firstName: null, lastName: null };
  }

  try {
    const personResult = await client.query({
      person: {
        __args: { filter: { id: { eq: personId } } },
        nameFirstName: true,
        nameLastName: true,
      },
    });

    return readCustomerName(
      (personResult.person as Record<string, unknown> | null) ?? null,
    );
  } catch {
    return { firstName: null, lastName: null };
  }
};

export type SyncTitleResult =
  | { applied: true; title: string; because: string }
  | { applied: false; because: string; title: string | null };

/**
 * Brings one interaction's title in line with its attempt and customer, exactly
 * once.
 *
 * The decision itself lives in the domain module and is pure; this only supplies
 * the facts it cannot get itself (the customer's current name) and performs the
 * write it asks for. Ownership is never inferred from the text here — the stored
 * `titleIsAuto` flag decides, and that is the whole reason the flag exists.
 */
export const syncSalesInteractionTitle = async ({
  client,
  recordId,
  fields,
  customerNameOverride,
}: {
  client: QueryClient & MutationClient;
  recordId: string;
  /** The interaction as the event reported it. */
  fields: TitleRecordFields;
  /**
   * The customer's name, when the caller already knows it. A bulk rename reads it
   * ONCE for the whole person instead of re-reading it per follow-up.
   */
  customerNameOverride?: { firstName: string | null; lastName: string | null };
}): Promise<SyncTitleResult> => {
  // The relation id is not part of the snapshot the caller parsed, so it is read
  // once from the record itself. A read failure is a refusal: without the lead we
  // cannot know the customer, and writing «مشتری بدون نام» over a real name would
  // be a downgrade.
  let eventLeadId: string | null = null;

  try {
    const result = await client.query({
      salesInteraction: {
        __args: { filter: { id: { eq: recordId } } },
        id: true,
        eventLeadId: true,
      },
    });

    const record = result.salesInteraction as
      | { eventLeadId?: unknown }
      | null
      | undefined;

    eventLeadId =
      typeof record?.eventLeadId === 'string' && record.eventLeadId.length > 0
        ? record.eventLeadId
        : null;
  } catch {
    return { applied: false, because: 'READ_FAILED', title: fields.title };
  }

  const customer =
    customerNameOverride ?? (await findCustomerName({ client, eventLeadId }));

  const decision = decideSalesInteractionTitle({
    state: {
      callAttempt: fields.callAttempt,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      title: fields.title,
      titleIsAuto: fields.titleIsAuto,
    },
  });

  if (!decision.apply) {
    return {
      applied: false,
      because: decision.because,
      title: decision.title,
    };
  }

  // Title and ownership are written TOGETHER: a title whose flag did not land
  // would be frozen as "manual" on the next event and never follow the attempt
  // again, so the two must not be separable.
  await client.mutation({
    updateSalesInteraction: {
      __args: {
        id: recordId,
        data: { name: decision.title, titleIsAuto: true },
      },
      id: true,
    },
  });

  return { applied: true, title: decision.title, because: decision.because };
};

/** Relation ids of the record, for a caller that needs to pre-check them. */
export const readEventLeadId = (payload: unknown): string | null =>
  readRelationIds(payload, 'after').eventLeadId;

export { readEventRecordId, readTitleRecordFields };
