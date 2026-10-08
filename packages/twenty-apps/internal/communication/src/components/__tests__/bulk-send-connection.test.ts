import { describe, expect, it } from 'vitest';

import { type BulkSendRecipient } from 'src/components/bulk-send-coordinator';
import {
  createBulkSendConnection,
  type BulkSendProgressState,
} from 'src/components/bulk-send-connection';
import { type SubmitTransportResponse } from 'src/components/submit-person-communication';

const recipient = (
  personId: string,
  phone: string,
  body: string,
): BulkSendRecipient => ({
  personId,
  displayName: personId,
  recipient: phone,
  body,
});

const accepted = (): SubmitTransportResponse => ({
  ok: true,
  status: 200,
  data: { success: true, status: 'SENT' },
});

const buildConnection = (
  responder: (personId: string) => SubmitTransportResponse,
) => {
  const requests: string[] = [];
  const states: BulkSendProgressState[] = [];

  const connection = createBulkSendConnection({
    transport: async (request) => {
      requests.push(request.personId);

      return responder(request.personId);
    },
    onState: (state) => states.push(state),
  });

  return { connection, requests, states };
};

describe('createBulkSendConnection (the button-to-coordinator wiring)', () => {
  it('sends one request per recipient and publishes a final summary', async () => {
    const { connection, requests, states } = buildConnection(() => accepted());

    const outcome = await connection.send({
      recipients: [recipient('p1', '1', 'a'), recipient('p2', '2', 'b')],
      channel: 'SMS',
    });

    expect(outcome.kind).toBe('COMPLETED');
    expect(requests).toEqual(['p1', 'p2']);

    const last = states[states.length - 1];
    expect(last.isRunning).toBe(false);
    expect(last.summary?.acceptedCount).toBe(2);
  });

  it('a double click starts only ONE run (the second is ignored without a request)', async () => {
    const { connection, requests } = buildConnection(() => accepted());

    const first = connection.send({
      recipients: [recipient('p1', '1', 'a')],
      channel: 'SMS',
    });

    // Second click in the same tick, before the first settles.
    const second = connection.send({
      recipients: [recipient('p1', '1', 'a')],
      channel: 'SMS',
    });

    expect(await second).toEqual({ kind: 'DUPLICATE_IGNORED' });

    await first;

    expect(requests).toEqual(['p1']);
  });

  it('stop() prevents the next recipient and keeps the in-flight result', async () => {
    const { connection, requests } = buildConnection(() => accepted());

    const run = connection.send({
      recipients: [
        recipient('p1', '1', 'a'),
        recipient('p2', '2', 'b'),
        recipient('p3', '3', 'c'),
      ],
      channel: 'SMS',
    });

    connection.stop();

    const outcome = await run;

    expect(requests).toEqual(['p1']);

    if (outcome.kind === 'COMPLETED') {
      expect(outcome.summary.isStopped).toBe(true);
      expect(outcome.summary.stopReason).toBe('USER');
    }
  });

  it('invalidate() disposes the connection so no later state is published', async () => {
    const { connection, states } = buildConnection(() => accepted());

    await connection.send({
      recipients: [recipient('p1', '1', 'a')],
      channel: 'SMS',
    });

    const countAfterRun = states.length;

    connection.invalidate();

    // No further publication, not even a cleared state.
    expect(states.length).toBe(countAfterRun);
  });

  it('a disposed connection refuses a new run', async () => {
    const { connection, requests } = buildConnection(() => accepted());

    connection.invalidate();

    const outcome = await connection.send({
      recipients: [recipient('p1', '1', 'a')],
      channel: 'SMS',
    });

    expect(outcome).toEqual({ kind: 'DUPLICATE_IGNORED' });
    expect(requests).toEqual([]);
  });

  it('a new send starts a fresh run with no leftover results', async () => {
    const { connection, states } = buildConnection(() => accepted());

    await connection.send({
      recipients: [recipient('p1', '1', 'a')],
      channel: 'SMS',
    });

    await connection.send({
      recipients: [recipient('p2', '2', 'b')],
      channel: 'SMS',
    });

    const last = states[states.length - 1];
    expect(last.summary?.results.map((result) => result.personId)).toEqual([
      'p2',
    ]);
  });
});
