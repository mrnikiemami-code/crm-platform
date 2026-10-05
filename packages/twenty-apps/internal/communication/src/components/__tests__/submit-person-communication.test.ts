import { describe, expect, it, vi } from 'vitest';

import {
  classifySubmitResponse,
  submitPersonCommunication,
  type SubmitTransport,
} from 'src/components/submit-person-communication';

const REQUEST = {
  personId: 'person-1',
  channel: 'SMS',
  recipient: '09120000000',
  body: 'hello',
};

const transportReturning = (
  data: Record<string, unknown>,
  overrides: { ok?: boolean; status?: number } = {},
): SubmitTransport =>
  vi.fn(async () => ({
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    data,
  }));

describe('classifySubmitResponse', () => {
  it('maps a successful send to SENT', () => {
    expect(
      classifySubmitResponse({ success: true, status: 'SENT' }),
    ).toEqual({ kind: 'SENT' });
  });

  it('maps a delivered result to DELIVERED', () => {
    expect(
      classifySubmitResponse({ success: true, status: 'DELIVERED' }),
    ).toEqual({ kind: 'DELIVERED' });
  });

  it('maps a provider rejection to PROVIDER_FAILED with its reason', () => {
    expect(
      classifySubmitResponse({
        success: false,
        status: 'FAILED',
        failureCode: 'PROVIDER_FAILED',
        isOutcomeKnown: true,
        error: 'Invalid receptor',
      }),
    ).toEqual({ kind: 'PROVIDER_FAILED', message: 'Invalid receptor' });
  });

  it('never presents a sent-but-unrecorded outcome as a non-send', () => {
    const outcome = classifySubmitResponse({
      success: false,
      status: 'SENT',
      failureCode: 'OUTCOME_NOT_PERSISTED',
      isOutcomeKnown: true,
      error:
        'The message was sent but its result could not be recorded. Do not retry automatically.',
    });

    expect(outcome.kind).toBe('SENT_BUT_UNRECORDED');
    expect(JSON.stringify(outcome)).toContain('was sent');
    expect(JSON.stringify(outcome)).not.toContain('could not be sent');
  });

  it('distinguishes a failed-but-unrecorded outcome', () => {
    const outcome = classifySubmitResponse({
      success: false,
      status: 'FAILED',
      failureCode: 'OUTCOME_NOT_PERSISTED',
      isOutcomeKnown: true,
      error:
        'The provider rejected the message and the failure could not be recorded. Do not retry automatically.',
    });

    expect(outcome.kind).toBe('FAILED_BUT_UNRECORDED');
  });

  it('uses the canonical wording for the actual server payload of an unknown outcome', () => {
    // This is exactly what the server currently returns for the double-failure
    // case: its own text asserts "could not be sent", which is not truthful.
    const outcome = classifySubmitResponse({
      success: false,
      communicationId: 'communication-1',
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
      error:
        'The message could not be sent and its state could not be recorded. Do not retry automatically.',
    });

    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
    expect(JSON.stringify(outcome)).toContain('may or may not have been sent');
    expect(JSON.stringify(outcome)).toContain('Check the communication history');
    // The server's "could not be sent" wording must never be reused.
    expect(JSON.stringify(outcome)).not.toContain('could not be sent');
  });

  it('never claims a definite non-send when the outcome is unknown', () => {
    const outcome = classifySubmitResponse({
      success: false,
      isOutcomeKnown: false,
    });

    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
    expect(JSON.stringify(outcome)).toContain('may or may not have been sent');
    expect(JSON.stringify(outcome)).toContain('Check the communication history');
    expect(JSON.stringify(outcome)).not.toContain('could not be sent');
  });
});

describe('submitPersonCommunication', () => {
  it('returns the truthful outcome for a successful send', async () => {
    const outcome = await submitPersonCommunication(REQUEST, {
      transport: transportReturning({ success: true, status: 'SENT' }),
    });

    expect(outcome).toEqual({ kind: 'SENT' });
  });

  it('reports OUTCOME_UNKNOWN when the transport rejects', async () => {
    const outcome = await submitPersonCommunication(REQUEST, {
      transport: vi.fn(async () => {
        throw new Error('SECRET-API-KEY in transport error');
      }),
    });

    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
    expect(JSON.stringify(outcome)).toContain('may or may not have been sent');
    expect(JSON.stringify(outcome)).not.toContain('could not be sent');
    // No raw exception text ever reaches the caller.
    expect(JSON.stringify(outcome)).not.toContain('SECRET-API-KEY');
  });

  it('reports OUTCOME_UNKNOWN when the response cannot be parsed', async () => {
    const outcome = await submitPersonCommunication(REQUEST, {
      transport: vi.fn(async () => {
        // A malformed payload stands in for a JSON parse failure.
        throw new SyntaxError('Unexpected token < in JSON');
      }),
    });

    expect(outcome.kind).toBe('OUTCOME_UNKNOWN');
    expect(JSON.stringify(outcome)).not.toContain('Unexpected token');
  });

  it('issues exactly one request for two immediate submissions and reports the duplicate distinctly', async () => {
    const transport = transportReturning({ success: true, status: 'SENT' });
    const isSubmittingRef = { current: false };

    const [first, second] = await Promise.all([
      submitPersonCommunication(REQUEST, { transport, isSubmittingRef }),
      submitPersonCommunication(REQUEST, { transport, isSubmittingRef }),
    ]);

    expect(transport).toHaveBeenCalledTimes(1);
    // The duplicate is reported as its own kind, never as an outcome the UI
    // could render as a warning or error.
    expect([first.kind, second.kind].sort()).toEqual(
      ['DUPLICATE_IGNORED', 'SENT'].sort(),
    );
    expect(second.kind).toBe('DUPLICATE_IGNORED');
    // It carries no message, so nothing can be displayed for it.
    expect(JSON.stringify(second)).not.toContain('message');
  });

  it('leaves the first request pending until it settles when a duplicate arrives', async () => {
    const isSubmittingRef = { current: false };

    let releaseFirst: (() => void) | undefined;
    const firstRequestGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const transport = vi.fn(async () => {
      await firstRequestGate;

      return { ok: true, status: 200, data: { success: true, status: 'SENT' } };
    }) as unknown as SubmitTransport;

    const first = submitPersonCommunication(REQUEST, {
      transport,
      isSubmittingRef,
    });

    // While the first request is in flight the guard is held.
    expect(isSubmittingRef.current).toBe(true);

    const second = await submitPersonCommunication(REQUEST, {
      transport,
      isSubmittingRef,
    });

    // The duplicate issued no request and is not a renderable outcome.
    expect(transport).toHaveBeenCalledTimes(1);
    expect(second.kind).toBe('DUPLICATE_IGNORED');

    // The first request is still pending and still holds the guard.
    expect(isSubmittingRef.current).toBe(true);

    releaseFirst?.();

    expect((await first).kind).toBe('SENT');
    expect(isSubmittingRef.current).toBe(false);
  });

  it('releases the guard after a failure without resending', async () => {
    const transport = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as SubmitTransport;
    const isSubmittingRef = { current: false };

    await submitPersonCommunication(REQUEST, { transport, isSubmittingRef });

    expect(isSubmittingRef.current).toBe(false);

    // A deliberate retry is allowed and is the only thing that sends again.
    await submitPersonCommunication(REQUEST, { transport, isSubmittingRef });

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('allows a later submission once the in-flight one settles', async () => {
    const transport = transportReturning({ success: true, status: 'SENT' });
    const isSubmittingRef = { current: false };

    await submitPersonCommunication(REQUEST, { transport, isSubmittingRef });
    await submitPersonCommunication(REQUEST, { transport, isSubmittingRef });

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('does not upgrade a sent-but-unrecorded outcome to success', async () => {
    const outcome = await submitPersonCommunication(REQUEST, {
      transport: transportReturning({
        success: false,
        status: 'SENT',
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: true,
      }),
    });

    expect(outcome.kind).toBe('SENT_BUT_UNRECORDED');
  });
});
