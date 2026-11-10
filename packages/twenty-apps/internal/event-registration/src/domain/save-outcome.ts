import { type OperatorProblem } from 'src/domain/operator';
import { type RegistrationPlanProblem } from 'src/domain/registration-plan';
import { type RegistrationTargetProblem } from 'src/domain/registration-target';

/** Everything a write may be refused for, each with its own remedy. */
export type SaveRejectionReason =
  | RegistrationTargetProblem
  | RegistrationPlanProblem
  | OperatorProblem;

// The truthful result of one save attempt. `kind` is what the form must show:
// nothing here upgrades a partial write into a full success, and a created
// registration whose payment was not recorded is its own outcome.
export type SaveRegistrationOutcome =
  | {
      kind: 'CREATED';
      registrationId: string;
      paymentId: string | null;
    }
  | { kind: 'ALREADY_REGISTERED'; registrationId: string }
  /** Registration is stored; the payment is not. Never retry blindly. */
  | {
      kind: 'REGISTERED_BUT_PAYMENT_FAILED';
      registrationId: string;
      message: string;
    }
  /** Nothing was written and the reason is a data problem the user can fix. */
  | { kind: 'REJECTED'; reason: SaveRejectionReason }
  /** Nothing is known to have been written; safe to try again. */
  | { kind: 'FAILED'; message: string };

export type SaveRegistrationResult = {
  success: boolean;
  outcome: SaveRegistrationOutcome;
};

export const toSaveResult = (
  outcome: SaveRegistrationOutcome,
): SaveRegistrationResult => ({
  success: outcome.kind === 'CREATED' || outcome.kind === 'ALREADY_REGISTERED',
  outcome,
});
