import {
  readCreatedRecordId,
  readExistingRegistration,
  readOperatorFromCurrentUser,
} from 'src/data/source-snapshot';
import {
  buildCreatePaymentMutation,
  buildCreateRegistrationMutation,
  buildCurrentOperatorQuery,
  buildExistingRegistrationQuery,
} from 'src/data/registration-queries';
import { resolveOperator } from 'src/domain/operator';
import { type SaveRegistrationOutcome } from 'src/domain/save-outcome';
import { decideRegistrationPlan } from 'src/domain/registration-plan';
import { type RegistrationTargetProblem } from 'src/domain/registration-target';
import { resolveRegistrationTarget } from 'src/domain/registration-target';
import { lookupLead } from 'src/services/lead-lookup';

export type SaveRegistrationRequest = {
  sourceObjectNameSingular: string;
  sourceRecordId: string;
  registrationStatus: string;
  agreedAmountToman: number | null;
  paidAmountToman: number | null;
  /**
   * The operator id the FUNCTION RUNTIME derived from the validated token, when
   * it supplies one. It never comes from the request body; when present it must
   * agree with what the platform reports for the session.
   */
  operatorUserWorkspaceId: string | null;
};

export type SaveRegistrationDependencies = {
  /** Injected so the whole write path is unit-testable without a workspace. */
  execute: (query: string) => Promise<Record<string, unknown>>;
  /**
   * Runs the identity probe with the CALLER's own token when the route forwards
   * it. Falls back to `execute` when the caller's token is not available.
   */
  executeOperator?: (query: string) => Promise<Record<string, unknown>>;
  /** Server clock, injected so the recorded timestamp is testable. */
  now?: () => Date;
};

const REGISTRATION_MODEL_MISSING =
  'The registration could not be saved. Nothing was written.';

const LOOKUP_PROBLEMS: Record<string, RegistrationTargetProblem> = {
  SOURCE_MISSING: 'SOURCE_NOT_FOUND',
  NO_LEAD: 'NO_LEAD_FOR_INTERACTION',
};

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
  // No business read happens before the acting person is established. The
  // first call is `currentUser`, guarded by `UserAuthGuard`, so an
  // application-only request fails here and nothing is written.
  const executeOperator = dependencies.executeOperator ?? dependencies.execute;
  let operatorData: Record<string, unknown>;

  try {
    operatorData = await executeOperator(buildCurrentOperatorQuery());
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

  const lookup = await lookupLead(
    request.sourceObjectNameSingular,
    request.sourceRecordId,
    { execute: dependencies.execute },
  );

  if (lookup.kind === 'UNREADABLE') {
    return { kind: 'FAILED', message: 'The record could not be read.' };
  }

  if (lookup.kind !== 'FOUND') {
    return { kind: 'REJECTED', reason: LOOKUP_PROBLEMS[lookup.kind] };
  }

  const target = resolveRegistrationTarget(lookup.snapshot);

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
          name: plan.payment.name,
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
