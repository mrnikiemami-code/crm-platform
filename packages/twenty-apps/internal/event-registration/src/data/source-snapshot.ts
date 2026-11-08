import { type LeadSnapshot } from 'src/domain/registration-target';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asId = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asName = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

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
  };
};

/** Reads the lead a sales interaction belongs to. */
export const readLeadFromInteractionResponse = (
  data: unknown,
): LeadSnapshot | null => {
  const envelope = asRecord(data);
  const interaction = asRecord(envelope?.salesInteraction);

  if (interaction === null) {
    return null;
  }

  const lead = asRecord(interaction.eventLead);

  if (lead === null) {
    // The interaction exists but points at no lead: a real data state, and one
    // the caller must report instead of treating as "no lead found".
    return { id: null, personId: null, eventId: null, name: null };
  }

  return {
    id: asId(lead.id),
    personId: asId(asRecord(lead.person)?.id),
    eventId: asId(asRecord(lead.academyEvent)?.id),
    name: asName(lead.name),
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

export const readCreatedRecordId = (
  data: unknown,
  mutationFieldName: string,
): string | null => asId(asRecord(asRecord(data)?.[mutationFieldName])?.id);
