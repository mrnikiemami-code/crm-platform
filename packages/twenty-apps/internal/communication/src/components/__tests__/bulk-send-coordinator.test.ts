import { describe, expect, it } from 'vitest';

import {
  runBulkSend,
  type BulkSendProgress,
  type BulkSendRecipient,
  type BulkSendRecipientResult,
  type BulkSendTransport,
} from 'src/components/bulk-send-coordinator';
import { type SubmitTransportResponse } from 'src/components/submit-person-communication';

const recipient = (
  personId: string,
  displayName: string,
  phone: string,
  body: string,
): BulkSendRecipient => ({ personId, displayName, recipient: phone, body });

// A transport that records every request and resolves with a scripted response.
const createRecordingTransport = (
  responder: (request: {
    personId: string;
    recipient: string;
    body: string;
  }) => SubmitTransportResponse | Promise<SubmitTransportResponse>,
) => {
  const requests: {
    personId: string;
    channel: string;
    recipient: string;
    body: string;
  }[] = [];

  const transport: BulkSendTransport = async (request) => {
    requests.push({ ...request });

    return responder(request);
  };

  return { transport, requests };
};

const accepted = (status: 'SENT' | 'DELIVERED' = 'SENT') => ({
  ok: true,
  status: 200,
  data: { success: true, status },
});

const definiteFailure = (error = 'mock rejection') => ({
  ok: true,
  status: 200,
  data: { success: false, failureCode: 'PROVIDER_FAILED', error },
});

const unknownOutcome = () => ({
  ok: true,
  status: 200,
  data: { success: false, isOutcomeKnown: false, error: 'boom' },
});

const recordingProblem = () => ({
  ok: true,
  status: 200,
  data: {
    success: false,
    failureCode: 'OUTCOME_NOT_PERSISTED',
    status: 'SENT',
    error:
      'The message was sent but its result could not be recorded. Do not retry automatically.',
  },
});

const kinds = (results: BulkSendRecipientResult[]) =>
  results.map((result) => result.kind);

describe('runBulkSend', () => {
  it('sends one request per recipient, in order, with each person OWN text and number', async () => {
    const { transport, requests } = createRecordingTransport(() => accepted());

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '09120000001', 'سلام سارا'),
        recipient('p2', 'Reza', '09120000002', 'سلام رضا'),
      ],
      channel: 'SMS',
      transport,
    });

    expect(outcome.kind).toBe('COMPLETED');
    expect(requests).toEqual([
      {
        personId: 'p1',
        channel: 'SMS',
        recipient: '09120000001',
        body: 'سلام سارا',
      },
      {
        personId: 'p2',
        channel: 'SMS',
        recipient: '09120000002',
        body: 'سلام رضا',
      },
    ]);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual(['ACCEPTED', 'ACCEPTED']);
      expect(outcome.summary.acceptedCount).toBe(2);
    }
  });

  it('never runs two requests concurrently (sequential, not Promise.all)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const transport: BulkSendTransport = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;

      return accepted();
    };

    await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
        recipient('p3', 'Mina', '3', 'c'),
      ],
      channel: 'SMS',
      transport,
    });

    expect(maxInFlight).toBe(1);
  });

  it('ignores a second click in the same tick without a second request', async () => {
    const { transport, requests } = createRecordingTransport(() => accepted());
    const isRunningRef = { current: false };

    const first = runBulkSend({
      recipients: [recipient('p1', 'Sara', '1', 'a')],
      channel: 'SMS',
      transport,
      isRunningRef,
    });
    const second = await runBulkSend({
      recipients: [recipient('p1', 'Sara', '1', 'a')],
      channel: 'SMS',
      transport,
      isRunningRef,
    });

    expect(second).toEqual({ kind: 'DUPLICATE_IGNORED' });

    await first;

    expect(requests).toHaveLength(1);
  });

  it('keeps going after a DEFINITE failure so other results are still reported', async () => {
    const { transport, requests } = createRecordingTransport((request) =>
      request.personId === 'p1' ? definiteFailure('mock rejection') : accepted(),
    );

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
      ],
      channel: 'SMS',
      transport,
    });

    expect(requests).toHaveLength(2);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual([
        'DEFINITE_FAILURE',
        'ACCEPTED',
      ]);
      expect(outcome.summary.definiteFailureCount).toBe(1);
      expect(outcome.summary.isStopped).toBe(false);
      expect(outcome.summary.results[0].message).toBe('mock rejection');
    }
  });

  it('stops the group on an UNKNOWN outcome and never attempts the rest', async () => {
    const { transport, requests } = createRecordingTransport((request) =>
      request.personId === 'p2' ? unknownOutcome() : accepted(),
    );

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
        recipient('p3', 'Mina', '3', 'c'),
      ],
      channel: 'SMS',
      transport,
    });

    // p3 is never requested.
    expect(requests.map((request) => request.personId)).toEqual(['p1', 'p2']);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual([
        'ACCEPTED',
        'UNKNOWN',
        'NOT_STARTED',
      ]);
      expect(outcome.summary.isStopped).toBe(true);
      expect(outcome.summary.stopReason).toBe('UNKNOWN');
      expect(outcome.summary.unknownCount).toBe(1);
      expect(outcome.summary.notStartedCount).toBe(1);
    }
  });

  it('stops the group when a transport throws (timeout) and marks it unknown', async () => {
    const { transport, requests } = createRecordingTransport((request) => {
      if (request.personId === 'p1') {
        throw new Error('timeout');
      }

      return accepted();
    });

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
      ],
      channel: 'SMS',
      transport,
    });

    expect(requests).toHaveLength(1);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual(['UNKNOWN', 'NOT_STARTED']);
      expect(outcome.summary.isStopped).toBe(true);
    }
  });

  it('stops the group on a recording problem', async () => {
    const { transport } = createRecordingTransport(() => recordingProblem());

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
      ],
      channel: 'SMS',
      transport,
    });

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual([
        'RECORDING_PROBLEM',
        'NOT_STARTED',
      ]);
      expect(outcome.summary.isStopped).toBe(true);
      expect(outcome.summary.unknownCount).toBe(1);
    }
  });

  it('stops before the NEXT recipient on a user stop and never relabels the in-flight one', async () => {
    let releaseFirst: (() => void) | null = null;
    const { transport, requests } = createRecordingTransport((request) => {
      if (request.personId === 'p1') {
        return new Promise<SubmitTransportResponse>((resolve) => {
          releaseFirst = () => resolve(accepted());
        });
      }

      return accepted();
    });

    let stopRequested = false;

    const run = runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
        recipient('p3', 'Mina', '3', 'c'),
      ],
      channel: 'SMS',
      transport,
      shouldStop: () => stopRequested,
    });

    // The user stops while p1 is still in flight.
    stopRequested = true;

    await new Promise((resolve) => setTimeout(resolve, 0));
    (releaseFirst as (() => void) | null)?.();

    const outcome = await run;

    // p1 completed normally; p2/p3 were never started.
    expect(requests.map((request) => request.personId)).toEqual(['p1']);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual([
        'ACCEPTED',
        'NOT_STARTED',
        'NOT_STARTED',
      ]);
      expect(outcome.summary.isStopped).toBe(true);
      expect(outcome.summary.stopReason).toBe('USER');
    }
  });

  it('ignores an input change after the snapshot (the confirmed texts are sent)', async () => {
    const { transport, requests } = createRecordingTransport(() => accepted());

    const recipients = [
      recipient('p1', 'Sara', '09120000001', 'متن تأییدشده سارا'),
    ];

    const run = runBulkSend({ recipients, channel: 'SMS', transport });

    // The user edits the form (mutating the array) after confirming.
    recipients[0] = recipient('p1', 'Sara', '09999999999', 'متن جدید');

    await run;

    expect(requests).toEqual([
      {
        personId: 'p1',
        channel: 'SMS',
        recipient: '09120000001',
        body: 'متن تأییدشده سارا',
      },
    ]);
  });

  it('publishes progress and preserves the results of the finished run', async () => {
    const { transport } = createRecordingTransport((request) =>
      request.personId === 'p2' ? unknownOutcome() : accepted(),
    );

    const snapshots: BulkSendProgress[] = [];

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
        recipient('p3', 'Mina', '3', 'c'),
      ],
      channel: 'SMS',
      transport,
      onProgress: (progress) =>
        snapshots.push({
          results: progress.results.map((r) => ({ ...r })),
          currentPersonId: progress.currentPersonId,
        }),
    });

    // Progress starts with everyone not started, then updates per recipient.
    expect(kinds(snapshots[0].results)).toEqual([
      'NOT_STARTED',
      'NOT_STARTED',
      'NOT_STARTED',
    ]);

    // The in-flight recipient is ANNOUNCED before its request resolves, so the
    // UI can show SENDING rather than leaving it looking not-started.
    expect(snapshots.some((snapshot) => snapshot.currentPersonId === 'p1')).toBe(
      true,
    );

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual([
        'ACCEPTED',
        'UNKNOWN',
        'NOT_STARTED',
      ]);
    }

    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(kinds(lastSnapshot.results)).toEqual([
      'ACCEPTED',
      'UNKNOWN',
      'NOT_STARTED',
    ]);
    expect(lastSnapshot.currentPersonId).toBeNull();
  });

  it('does not retry a recipient after an unknown outcome', async () => {
    const { transport, requests } = createRecordingTransport(() =>
      unknownOutcome(),
    );

    await runBulkSend({
      recipients: [recipient('p1', 'Sara', '1', 'a')],
      channel: 'SMS',
      transport,
    });

    expect(requests).toHaveLength(1);
  });

  it('D: a transport that rejects at the deadline stops the group — no next recipient', async () => {
    // Models the real deadline: the transport itself rejects, exactly as the
    // deadline race makes `callAppRoute` reject. The coordinator must classify
    // it UNKNOWN and never start the next recipient.
    const { transport, requests } = createRecordingTransport((request) => {
      if (request.personId === 'p1') {
        throw new Error('Request deadline exceeded');
      }

      return accepted();
    });

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
      ],
      channel: 'SMS',
      transport,
    });

    expect(requests.map((request) => request.personId)).toEqual(['p1']);

    if (outcome.kind === 'COMPLETED') {
      expect(kinds(outcome.summary.results)).toEqual(['UNKNOWN', 'NOT_STARTED']);
      expect(outcome.summary.isStopped).toBe(true);
    }
  });

  it('reports SENT distinctly from DELIVERED', async () => {
    const { transport } = createRecordingTransport((request) =>
      request.personId === 'p1' ? accepted('SENT') : accepted('DELIVERED'),
    );

    const outcome = await runBulkSend({
      recipients: [
        recipient('p1', 'Sara', '1', 'a'),
        recipient('p2', 'Reza', '2', 'b'),
      ],
      channel: 'SMS',
      transport,
    });

    if (outcome.kind === 'COMPLETED') {
      expect(outcome.summary.results[0]).toMatchObject({
        kind: 'ACCEPTED',
        status: 'SENT',
      });
      expect(outcome.summary.results[1]).toMatchObject({
        kind: 'ACCEPTED',
        status: 'DELIVERED',
      });
    }
  });
});
