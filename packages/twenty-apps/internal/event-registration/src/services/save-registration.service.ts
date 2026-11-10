import {
  readCreatedRecordId,
  readExistingRegistration,
  readLeadFromInteractionResponse,
  readLeadFromLeadResponse,
  readOperatorFromCurrentUser,
} from 'src/data/source-snapshot';
import {
  buildCreatePaymentMutation,
  buildCreateRegistrationMutation,
  buildCurrentOperatorQuery,
  buildExistingRegistrationQuery,
  buildLeadQuery,
} from 'src/data/registration-queries';
import {
  LEAD_RELATION_BY_SOURCE_OBJECT,
  isSupportedSourceObject,
} from 'src/data/object-names';
import { resolveOperator } from 'src/domain/operator';
import { type SaveRegistrationOutcome } from 'src/domain/save-outcome';
import { decideRegistrationPlan } from 'src/domain/registration-plan';
import { resolveRegistrationTarget } from 'src/domain/registration-target';

export type SaveRegistrationRequest = {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
  registrationStatus: string;
  agreedAmountToman: number | null;
  paidAmountToman: number | null;
  /**
   * The operator id the FUNCTION RUNTIME derived from the validated token. It is
   * never read from the request body; passing it here only mirrors what the
   * runtime already knows.
   */
  operatorUserWorkspaceId: string | null;
};

export type SaveRegistrationDependencies = {
  /** Injected so the whole write path is unit-testable without a workspace. */
  execute: (query: string) => Promise<Record<string, unknown>>;
  /** Server clock, injected so the recorded timestamp is testable. */
  now?: () => Date;
};

const REGISTRATION_MODEL_MISSING =
  'The registration could not be saved. Nothing was written.';

/**
 * Performs the save. Order is deliberate:
 *
 *   0. establish WHO is acting — refuse if the request is not a signed-in person
 *      (this is the fail-closed gate; see `buildCurrentOperatorQuery`),
 *   1. resolve the lead from the SELECTED record (never from client fields),
 *   2. look for an existing registration and stop if there is one,
 *   3. create the registration, with its seller and server timestamp,
 *   4. create the payment only when money was actually received.
 *
 * The sales interaction is never written, so its history is untouched. Step 4
 * failing is reported as its own outcome: the registration is stored and the
 * user is told the payment is not, rather than being told the save failed.
 */
export const saveRegistration = async (
  request: SaveRegistrationRequest,
  dependencies: SaveRegistrationDependencies,
): Promise<SaveRegistrationOutcome> => {
  // ---------- 0. operator gate ----------
  // An application-only request must not get as far as a single read: refuse
  // here, before the network, when the runtime itself has no operator id.
  if (
    typeof request.operatorUserWorkspaceId !== 'string' ||
    request.operatorUserWorkspaceId.length === 0
  ) {
    return { kind: 'REJECTED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  // Called next, before any read of business data: `currentUser` is guarded by
  // `UserAuthGuard`, so this also proves the session carries a real person.
  let operatorData: Record<string, unknown>;

  try {
    operatorData = await dependencies.execute(buildCurrentOperatorQuery());
  } catch {
    // No readable user context means we cannot prove who is acting.
    return { kind: 'REJECTED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  const operator = resolveOperator(
    readOperatorFromCurrentUser(operatorData),
    request.operatorUserWorkspaceId,
  );
  if (operator.kind === 'UNRESOLVED') {
    return { kind: 'REJECTED', reason: operator.reason };
  }

  if (!isSupportedSourceObject(request.sourceObjectNameSingular)) {
    return { kind: 'REJECTED', reason: 'SOURCE_NOT_FOUND' };
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
    return { kind: 'FAILED', message: 'The record could not be read.' };
  }

  const snapshot =
    leadRelation === null
      ? readLeadFromLeadResponse(leadData)
      : readLeadFromInteractionResponse(leadData);

  const target = resolveRegistrationTarget(snapshot);

  if (target.kind === 'UNRESOLVED') {
    return { kind: 'REJECTED', reason: target.reason };
  }

  let existingRegistrationId: string | null;

  try {
    existingRegistrationId =
      readExistingRegistration(
        await dependencies.execute(
          buildExistingRegistrationQuery(target.leadId),
        ),
      )?.id ?? null;
  } catch {
    // Without a trustworthy answer here a duplicate could be created, so the
    // save stops instead of guessing that none exists.
    return {
      kind: 'FAILED',
      message: 'Existing registrations could not be checked.',
    };
  }

  const now = dependencies.now?.() ?? new Date();

  const plan = decideRegistrationPlan(
    target,
    {
      registrationStatus: request.registrationStatus,
      agreedAmountToman: request.agreedAmountToman,
      paidAmountToman: request.paidAmountToman,
    },
    existingRegistrationId,
    {
      registeredAtIso: now.toISOString(),
      sellerName: operator.displayName,
    },
  );

  if (plan.kind === 'ALREADY_REGISTERED') {
    return { kind: 'ALREADY_REGISTERED', registrationId: plan.registrationId };
  }

  if (plan.kind === 'INVALID') {
    return { kind: 'REJECTED', reason: plan.reason };
  }

  let registrationId: string | null;

  try {
    registrationId = readCreatedRecordId(
      await dependencies.execute(
        buildCreateRegistrationMutation({
          name: plan.registration.name,
          registrationStatus: plan.registration.registrationStatus,
          finalAmountToman: plan.registration.finalAmountToman,
          academyEventId: plan.registration.academyEventId,
          eventLeadId: plan.registration.eventLeadId,
          personId: plan.registration.personId,
          soldByRaw: plan.registration.soldByRaw,
          registeredAt: plan.registration.registeredAt,
        }),
      ),
      'createEventRegistration',
    );
  } catch {
    return { kind: 'FAILED', message: REGISTRATION_MODEL_MISSING };
  }

  if (registrationId === null) {
    return { kind: 'FAILED', message: REGISTRATION_MODEL_MISSING };
  }

  if (plan.payment === null) {
    return { kind: 'CREATED', registrationId, paymentId: null };
  }

  try {
    const paymentId = readCreatedRecordId(
      await dependencies.execute(
        buildCreatePaymentMutation({
          amountToman: plan.payment.amountToman,
          eventRegistrationId: registrationId,
          soldByRaw: plan.payment.soldByRaw,
        }),
      ),
      'createRegistrationPayment',
    );

    if (paymentId === null) {
      return {
        kind: 'REGISTERED_BUT_PAYMENT_FAILED',
        registrationId,
        message: 'The registration is saved but the payment is not recorded.',
      };
    }

    return { kind: 'CREATED', registrationId, paymentId };
  } catch {
    return {
      kind: 'REGISTERED_BUT_PAYMENT_FAILED',
      registrationId,
      message: 'The registration is saved but the payment is not recorded.',
    };
  }
};
