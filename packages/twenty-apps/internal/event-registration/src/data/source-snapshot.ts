import { type OperatorSnapshot } from 'src/domain/operator';
import { type LeadSnapshot } from 'src/domain/registration-target';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asId = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asName = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/** `name { firstName lastName }` of any record, as one label. */
const readMemberName = (value: unknown): string | null => {
  const name = asRecord(asRecord(value)?.name);

  const parts = [asName(name?.firstName), asName(name?.lastName)].filter(
    (part): part is string => part !== null,
  );

  return parts.length > 0 ? parts.join(' ') : null;
};

export { readMemberName };

/** Reads the lead a `eventLead(filter: { id: { eq } })` response returned. */
export const readLeadFromLeadResponse = (data: unknown): LeadSnapshot | null => {
  const envelope = asRecord(data);
  const lead = asRecord(envelope?.eventLead);

  if (lead === null) {
    return null;
  }

  return {
    id: asId(lead.id),
    personId: asId(asRecord(lead.person)?.id),
    eventId: asId(asRecord(lead.academyEvent)?.id),
    name: asName(lead.name),
    performedByName: null,
    personName: readMemberName(lead.person),
    eventName: asName(asRecord(lead.academyEvent)?.name),
  };
};

export type InteractionHead = {
  leadId: string | null;
  leadName: string | null;
  /** Who performed the call, as a workspace member label. */
  performedByName: string | null;
};

/**
 * Reads only the first level of an interaction: the lead it points at and who
 * made the call. The lead's own relations are read in a second request, because
 * a nested `eventLead { person { … } }` comes back null on this server.
 */
export const readInteractionHead = (data: unknown): InteractionHead | null => {
  const envelope = asRecord(data);
  const interaction = asRecord(envelope?.salesInteraction);

  if (interaction === null) {
    return null;
  }

  const lead = asRecord(interaction.eventLead);

  return {
    leadId: asId(lead?.id),
    leadName: asName(lead?.name),
    performedByName: readMemberName(interaction.performedBy),
  };
};
export type ExistingRegistration = {
  id: string;
  registrationStatus: string | null;
};

export const readExistingRegistration = (
  data: unknown,
): ExistingRegistration | null => {
  const envelope = asRecord(data);
  const edges = asRecord(envelope?.eventRegistrations)?.edges;

  if (!Array.isArray(edges)) {
    return null;
  }

  for (const edge of edges) {
    const node = asRecord(asRecord(edge)?.node);
    const id = asId(node?.id);

    if (id !== null) {
      return {
        id,
        registrationStatus:
          typeof node?.registrationStatus === 'string'
            ? node.registrationStatus
            : null,
      };
    }
  }

  return null;
};

/**
 * Reads the signed-in operator from a `currentUser` response.
 *
 * Returns `null` when the response carries no user at all — which is what an
 * application-only request produces — so the caller refuses to write.
 */
export const readOperatorFromCurrentUser = (
  data: unknown,
): OperatorSnapshot | null => {
  const envelope = asRecord(data);
  const user = asRecord(envelope?.currentUser);

  if (user === null) {
    return null;
  }

  const member = asRecord(user.workspaceMember);

  return {
    workspaceMemberId: asId(member?.id),
    userWorkspaceId: asId(member?.userWorkspaceId),
    displayName: readMemberName(member),
  };
};

export const readCreatedRecordId = (
  data: unknown,
  mutationFieldName: string,
): string | null => asId(asRecord(asRecord(data)?.[mutationFieldName])?.id);
