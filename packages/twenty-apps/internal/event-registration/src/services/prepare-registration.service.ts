import { readExistingRegistration } from 'src/data/source-snapshot';
import { buildExistingRegistrationQuery } from 'src/data/registration-queries';
import { type RegistrationTargetProblem } from 'src/domain/registration-target';
import { resolveRegistrationTarget } from 'src/domain/registration-target';
import { lookupLead } from 'src/services/lead-lookup';

export type PrepareRegistrationRequest = {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
};

export type PreparedRegistration = {
  success: true;
  leadId: string;
  leadName: string | null;
  personId: string;
  eventId: string;
  personName: string | null;
  eventName: string | null;
  performedByName: string | null;
  existingRegistration: {
    id: string;
    registrationStatus: string | null;
  } | null;
};

export type PrepareRegistrationFailure = {
  success: false;
  reason: RegistrationTargetProblem | 'UNREADABLE';
};

export type PrepareRegistrationDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
};

const LOOKUP_PROBLEMS: Record<string, RegistrationTargetProblem | 'UNREADABLE'> =
  {
    SOURCE_MISSING: 'SOURCE_NOT_FOUND',
    NO_LEAD: 'NO_LEAD_FOR_INTERACTION',
    UNREADABLE: 'UNREADABLE',
  };

/**
 * Read-only prefill for the form. It resolves the SAME path the save uses, so
 * what the form shows is exactly what will be written; the client never sends
 * the person, lead or event identifiers back as trusted values.
 */
export const prepareRegistration = async (
  request: PrepareRegistrationRequest,
  dependencies: PrepareRegistrationDependencies,
): Promise<PreparedRegistration | PrepareRegistrationFailure> => {
  const lookup = await lookupLead(
    request.sourceObjectNameSingular,
    request.sourceRecordId,
    { execute: dependencies.execute },
  );

  if (lookup.kind !== 'FOUND') {
    return { success: false, reason: LOOKUP_PROBLEMS[lookup.kind] };
  }

  const target = resolveRegistrationTarget(lookup.snapshot);

  if (target.kind === 'UNRESOLVED') {
    return { success: false, reason: target.reason };
  }

  let existingRegistration: PreparedRegistration['existingRegistration'] =
    null;

  try {
    existingRegistration = readExistingRegistration(
      await dependencies.execute(buildExistingRegistrationQuery(target.leadId)),
    );
  } catch {
    // A failed duplicate check must not look like "nothing exists": the form is
    // told the prefill is unreadable instead of offering a create that would
    // duplicate a registration.
    return { success: false, reason: 'UNREADABLE' };
  }

  return {
    success: true,
    leadId: target.leadId,
    leadName: target.leadName,
    personId: target.personId,
    eventId: target.eventId,
    // The ids above are the contract; the labels are for the human reading the
    // form, and come from the same records rather than from the client.
    personName: lookup.snapshot.personName,
    eventName: lookup.snapshot.eventName,
    performedByName: target.performedByName,
    existingRegistration,
  };
};
