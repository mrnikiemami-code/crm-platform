import { type SubmitPersonCommunicationOutcome } from 'src/components/submit-person-communication';

// How the composer presents each truthful outcome. Kept in production code (not
// the test) so the composer and its test share one mapping: a definite failure
// is an error, an uncertain result is a warning. The message is carried through
// so the caller never has to re-narrow the union.
export type SubmitOutcomePresentation =
  | { variant: 'success' }
  | { variant: 'error'; message: string }
  | { variant: 'warning'; message: string };

export const resolveSubmitOutcomePresentation = (
  outcome: SubmitPersonCommunicationOutcome,
): SubmitOutcomePresentation => {
  switch (outcome.kind) {
    case 'SENT':
    case 'DELIVERED':
      return { variant: 'success' };
    case 'PROVIDER_FAILED':
    case 'INVALID_INPUT':
    case 'FAILED_BUT_UNRECORDED':
      return { variant: 'error', message: outcome.message };
    case 'SENT_BUT_UNRECORDED':
    case 'OUTCOME_UNKNOWN':
      return { variant: 'warning', message: outcome.message };
    case 'DUPLICATE_IGNORED':
      // A duplicate is not a result; the caller must render nothing for it.
      throw new Error('DUPLICATE_IGNORED is not a renderable outcome');
  }
};
