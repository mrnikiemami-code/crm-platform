import { describe, expect, it } from 'vitest';

import { resolveSubmitOutcomePresentation } from 'src/components/submit-outcome-variant';

// Locks the UI severity for every outcome. A definite failure is an ERROR; an
// unknown outcome and a sent-but-unrecorded result are WARNINGS. This is the
// exact mapping the composer uses, so a change that silently downgrades a
// failure (or upgrades an uncertainty) fails here.
describe('composer outcome severity', () => {
  it('treats a definite provider failure as an error', () => {
    expect(
      resolveSubmitOutcomePresentation({ kind: 'PROVIDER_FAILED', message: 'x' }),
    ).toEqual({ variant: 'error', message: 'x' });
  });

  it('treats an invalid input as an error', () => {
    expect(
      resolveSubmitOutcomePresentation({ kind: 'INVALID_INPUT', message: 'x' }),
    ).toEqual({ variant: 'error', message: 'x' });
  });

  it('treats a failure that could not be recorded as an error, not a warning', () => {
    expect(
      resolveSubmitOutcomePresentation({
        kind: 'FAILED_BUT_UNRECORDED',
        message: 'x',
      }),
    ).toEqual({ variant: 'error', message: 'x' });
  });

  it('treats an unknown outcome as a warning', () => {
    expect(
      resolveSubmitOutcomePresentation({ kind: 'OUTCOME_UNKNOWN', message: 'x' }),
    ).toEqual({ variant: 'warning', message: 'x' });
  });

  it('treats a sent-but-unrecorded result as a warning', () => {
    expect(
      resolveSubmitOutcomePresentation({ kind: 'SENT_BUT_UNRECORDED', message: 'x' }),
    ).toEqual({ variant: 'warning', message: 'x' });
  });

  it('treats a sent or delivered result as a success', () => {
    expect(resolveSubmitOutcomePresentation({ kind: 'SENT' })).toEqual({
      variant: 'success',
    });
    expect(resolveSubmitOutcomePresentation({ kind: 'DELIVERED' })).toEqual({
      variant: 'success',
    });
  });

  it('never renders a duplicate', () => {
    expect(() =>
      resolveSubmitOutcomePresentation({ kind: 'DUPLICATE_IGNORED' }),
    ).toThrow();
  });
});
