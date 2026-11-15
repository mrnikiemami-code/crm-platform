import { type RegistrationTarget } from 'src/domain/registration-target';
import {
  buildPaymentTitle,
  buildRegistrationTitle,
} from 'src/domain/record-title';

// Only the two states the form offers. The remaining values of the object's
// status field belong to other flows (partial payment, refund) and are not
// invented here.
export const OFFERED_REGISTRATION_STATUSES = [
  'PYSHTHBTNM',
  'THBTNM_QTAAY',
] as const;

export type OfferedRegistrationStatus =
  (typeof OFFERED_REGISTRATION_STATUSES)[number];

export type RegistrationRequest = {
  registrationStatus: string;
  agreedAmountToman: number | null;
  paidAmountToman: number | null;
};

export type RegistrationPlanProblem =
  | 'STATUS_NOT_OFFERED'
  | 'AMOUNT_NOT_A_NUMBER'
  | 'AMOUNT_NEGATIVE'
  | 'AMOUNT_NOT_INTEGER'
  | 'PAID_EXCEEDS_AGREED';

/**
 * Facts the caller must supply from the SERVER, never from the request body:
 * when the registration happened, and who it is attributed to.
 */
export type RegistrationPlanContext = {
  /** ISO timestamp taken on the server. */
  registeredAtIso: string;
  /**
   * The seller the platform can vouch for. `null` is allowed but is NOT a
   * silent zero: the field is simply left unset, which the dashboard already
   * treats as "unattributed".
   */
  sellerName: string | null;
};

export type RegistrationPlan =
  | { kind: 'ALREADY_REGISTERED'; registrationId: string }
  | { kind: 'INVALID'; reason: RegistrationPlanProblem }
  | {
      kind: 'CREATE';
      registration: {
        eventLeadId: string;
        personId: string;
        academyEventId: string;
        registrationStatus: OfferedRegistrationStatus;
        finalAmountToman: number | null;
        name: string | null;
        soldByRaw: string | null;
        registeredAt: string;
      };
      payment: { amountToman: number; name: string; soldByRaw: string | null } | null;
    };

const isOfferedStatus = (value: string): value is OfferedRegistrationStatus =>
  (OFFERED_REGISTRATION_STATUSES as ReadonlyArray<string>).includes(value);

/**
 * An absent amount (`null` / empty) means "not given", never zero: a zero
 * agreed amount is a real statement the user may one day make, so nothing is
 * defaulted.
 *
 * `AmountProblem` is what makes an amount unacceptable; the caller asks once and
 * then reads the number directly once the answer is "acceptable".
 */
type AmountProblem = 'NOT_A_NUMBER' | 'NEGATIVE' | 'NOT_INTEGER';

/**
 * The money in this workspace is toman, and toman has no sub-unit in use here.
 * A fractional value is not "a slightly different amount": it is a value the
 * field cannot honestly hold, and rounding it silently would change what the
 * customer was told. So a decimal is refused rather than truncated.
 */
const readAmountProblem = (value: number | null): AmountProblem | null => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'NOT_A_NUMBER';
  }

  if (value < 0) {
    return 'NEGATIVE';
  }

  return Number.isInteger(value) ? null : 'NOT_INTEGER';
};

const AMOUNT_PROBLEM_TO_PLAN_PROBLEM: Record<
  AmountProblem,
  RegistrationPlanProblem
> = {
  NOT_A_NUMBER: 'AMOUNT_NOT_A_NUMBER',
  NEGATIVE: 'AMOUNT_NEGATIVE',
  NOT_INTEGER: 'AMOUNT_NOT_INTEGER',
};

/**
 * Turns a validated request into the exact writes the server will perform.
 *
 * Duplicate prevention lives HERE, before any write: an existing registration
 * for the same lead is reported instead of being recreated, and no second
 * payment is ever proposed for it.
 */
export const decideRegistrationPlan = (
  target: Extract<RegistrationTarget, { kind: 'RESOLVED' }>,
  request: RegistrationRequest,
  existingRegistrationId: string | null,
  context: RegistrationPlanContext,
): RegistrationPlan => {
  if (existingRegistrationId !== null && existingRegistrationId.length > 0) {
    return {
      kind: 'ALREADY_REGISTERED',
      registrationId: existingRegistrationId,
    };
  }

  if (!isOfferedStatus(request.registrationStatus)) {
    return { kind: 'INVALID', reason: 'STATUS_NOT_OFFERED' };
  }

  const agreedProblem = readAmountProblem(request.agreedAmountToman);

  if (agreedProblem !== null) {
    return {
      kind: 'INVALID',
      reason: AMOUNT_PROBLEM_TO_PLAN_PROBLEM[agreedProblem],
    };
  }

  const paidProblem = readAmountProblem(request.paidAmountToman);

  if (paidProblem !== null) {
    return {
      kind: 'INVALID',
      reason: AMOUNT_PROBLEM_TO_PLAN_PROBLEM[paidProblem],
    };
  }

  const agreed = request.agreedAmountToman;
  const paid = request.paidAmountToman;

  // Paying more than the agreed price is not a rounding difference, it is a
  // different commercial agreement. Recording it would make the payment look
  // like it settled a price the registration never stated, so the write is
  // refused and the operator is asked to correct one of the two numbers.
  // A missing agreed amount gives nothing to compare against, so it does not
  // block; a missing paid amount means no payment row at all.
  if (agreed !== null && paid !== null && paid > agreed) {
    return { kind: 'INVALID', reason: 'PAID_EXCEEDS_AGREED' };
  }

  // The interaction's own performer wins over the operator: it is who actually
  // made the call. Both come from platform records, never from the client.
  const sellerName = target.performedByName ?? context.sellerName;

  const titleFacts = {
    personName: target.personName,
    eventName: target.eventName,
    leadName: target.leadName,
  };

  return {
    kind: 'CREATE',
    registration: {
      eventLeadId: target.leadId,
      personId: target.personId,
      academyEventId: target.eventId,
      registrationStatus: request.registrationStatus,
      finalAmountToman: agreed,
      // The label identifier is a real stored field, so the record is readable
      // in every list and search — not only inside this form.
      name: buildRegistrationTitle(titleFacts),
      soldByRaw: sellerName,
      registeredAt: context.registeredAtIso,
    },
    // A zero or absent paid amount means the payment object is left alone: no
    // placeholder row is created for money that was not received.
    payment:
      paid !== null && paid > 0
        ? {
            amountToman: paid,
            name: buildPaymentTitle({ amountToman: paid, ...titleFacts }),
            soldByRaw: sellerName,
          }
        : null,
  };
};
