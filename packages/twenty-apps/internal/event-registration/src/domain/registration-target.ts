// A lead, reduced to the facts a registration write actually needs. Built by
// the data layer from whatever the source record pointed at, so the decision
// below never depends on which object the user clicked from.
export type LeadSnapshot = {
  id: string | null;
  personId: string | null;
  eventId: string | null;
  /**
   * The lead's own label, reused as the registration's label so the new record
   * is readable in every list. It is copied from data that already exists,
   * never composed from guesses.
   */
  name: string | null;
  /**
   * Who performed the call, when the source record carries it and the platform
   * resolved it to a workspace member. This is the authoritative seller for an
   * interaction-based registration; `null` for a lead record.
   */
  performedByName: string | null;
  /** Labels for the form, read from the same records as the ids. */
  personName: string | null;
  eventName: string | null;
};

export type RegistrationTargetProblem =
  | 'SOURCE_NOT_FOUND'
  | 'NO_LEAD_FOR_INTERACTION'
  | 'NO_PERSON_ON_LEAD'
  | 'NO_EVENT_ON_LEAD';

export type RegistrationTarget =
  | {
      kind: 'RESOLVED';
      leadId: string;
      personId: string;
      eventId: string;
      leadName: string | null;
      /**
       * Seller resolved from the source record itself (an interaction's
       * `performedBy`). `null` means the caller must fall back to the operator
       * identity — never to a name typed in the browser.
       */
      performedByName: string | null;
    }
  | { kind: 'UNRESOLVED'; reason: RegistrationTargetProblem };

const present = (value: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Decides whether a lead can carry a registration at all.
 *
 * Every required relation is reported by its own name rather than collapsed
 * into one "invalid" answer: a lead with no event and a lead with no person are
 * different data problems and the user fixes them in different places.
 */
export const resolveRegistrationTarget = (
  lead: LeadSnapshot | null,
): RegistrationTarget => {
  if (lead === null || !present(lead.id)) {
    return { kind: 'UNRESOLVED', reason: 'SOURCE_NOT_FOUND' };
  }

  if (!present(lead.personId)) {
    return { kind: 'UNRESOLVED', reason: 'NO_PERSON_ON_LEAD' };
  }

  if (!present(lead.eventId)) {
    return { kind: 'UNRESOLVED', reason: 'NO_EVENT_ON_LEAD' };
  }

  return {
    kind: 'RESOLVED',
    leadId: lead.id,
    personId: lead.personId,
    eventId: lead.eventId,
    leadName: lead.name,
    performedByName: lead.performedByName,
  };
};
