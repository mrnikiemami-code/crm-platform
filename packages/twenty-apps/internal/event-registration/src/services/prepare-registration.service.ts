import {
  readExistingRegistration,
  readLeadFromInteractionResponse,
  readLeadFromLeadResponse,
} from 'src/data/source-snapshot';
import {
  buildExistingRegistrationQuery,
  buildLeadQuery,
} from 'src/data/registration-queries';
import {
  LEAD_RELATION_BY_SOURCE_OBJECT,
  isSupportedSourceObject,
} from 'src/data/object-names';
import { type RegistrationTargetProblem, resolveRegistrationTarget } from 'src/domain/registration-target';
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

/**
 * Read-only prefill for the form. It resolves the SAME path the save uses, so
 * what the form shows is exactly what will be written; the client never sends
 * the person, lead or event identifiers back as trusted values.
 */
export const prepareRegistration = async (
  request: PrepareRegistrationRequest,
  dependencies: PrepareRegistrationDependencies,
): Promise<PreparedRegistration | PrepareRegistrationFailure> => {
  if (!isSupportedSourceObject(request.sourceObjectNameSingular)) {
    return { success: false, reason: 'SOURCE_NOT_FOUND' };
  }

  const leadRelation =
    LEAD_RELATION_BY_SOURCE_OBJECT[request.sourceObjectNameSingular];

  let leadData: Record<string, unknown>;

  try {
    leadData = await dependencies.execute(
      buildLeadQuery(
        request.sourceObjectNameSingular,
        leadRelation,
        request.sourceRecordId,
      ),
    );
  } catch {
    return { success: false, reason: 'UNREADABLE' };
  }

  const snapshot =
    leadRelation === null
      ? readLeadFromLeadResponse(leadData)
      : readLeadFromInteractionResponse(leadData);

  const target = resolveRegistrationTarget(snapshot);

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
    existingRegistration,
  };
};
