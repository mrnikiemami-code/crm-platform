import { describe, expect, it, vi } from 'vitest';

import { saveRegistration } from 'src/services/save-registration.service';

const LEAD_RESPONSE = {
  eventLead: {
    id: 'lead-1',
    name: 'مهران صالحپور',
    person: { id: 'person-1' },
    academyEvent: { id: 'event-1' },
  },
};

const INTERACTION_RESPONSE = {
  salesInteraction: {
    id: 'interaction-1',
    eventLead: {
      id: 'lead-1',
      name: 'مهران صالحپور',
      person: { id: 'person-1' },
      academyEvent: { id: 'event-1' },
    },
  },
};

const NO_REGISTRATION = { eventRegistrations: { edges: [] } };

const REQUEST = {
  sourceObjectNameSingular: 'eventLead',
  sourceRecordId: 'lead-1',
  registrationStatus: 'PYSHTHBTNM',
  agreedAmountToman: 3900000,
  paidAmountToman: 0,
};

/**
 * A scripted record API: each call consumes the next queued answer, so a test
 * states the exact sequence of reads and writes it expects.
 */
const createExecute = (
  answers: Array<Record<string, unknown> | Error>,
): ((query: string) => Promise<Record<string, unknown>>) & {
  queries: string[];
} => {
  const queries: string[] = [];
  let index = 0;

  const execute = async (query: string) => {
    queries.push(query);
    const answer = answers[index];
    index += 1;

    if (answer instanceof Error) {
      throw answer;
    }

    if (answer === undefined) {
      throw new Error(`Unexpected request #${index}`);
    }

    return answer;
  };

  return Object.assign(execute, { queries });
};

describe('saveRegistration', () => {
  it('registers a lead without creating a payment row', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    const outcome = await saveRegistration(REQUEST, { execute });

    expect(outcome).toEqual({
      kind: 'CREATED',
      registrationId: 'registration-1',
      paymentId: null,
    });
    // Three calls only: no payment mutation went out.
    expect(execute.queries).toHaveLength(3);
    expect(execute.queries.some((query) => query.includes('createRegistrationPayment'))).toBe(
      false,
    );
  });

  it('registers a lead and records the payment when money was received', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
      { createRegistrationPayment: { id: 'payment-1' } },
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 1500000 },
      { execute },
    );

    expect(outcome).toEqual({
      kind: 'CREATED',
      registrationId: 'registration-1',
      paymentId: 'payment-1',
    });
    expect(execute.queries[3]).toContain('1500000');
    expect(execute.queries[3]).toContain('registration-1');
  });

  it('resolves the lead through the interaction, never from client fields', async () => {
    const execute = createExecute([
      INTERACTION_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    const outcome = await saveRegistration(
      {
        ...REQUEST,
        sourceObjectNameSingular: 'salesInteraction',
        sourceRecordId: 'interaction-1',
      },
      { execute },
    );

    expect(outcome.kind).toBe('CREATED');
    expect(execute.queries[0]).toContain('salesInteraction');
    // The registration is written against the LEAD the interaction points at.
    expect(execute.queries[2]).toContain('lead-1');
    expect(execute.queries[2]).toContain('person-1');
    expect(execute.queries[2]).toContain('event-1');
  });

  it('writes nothing when a registration already exists', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      { eventRegistrations: { edges: [{ node: { id: 'registration-9' } }] } },
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 5000000 },
      { execute },
    );

    expect(outcome).toEqual({
      kind: 'ALREADY_REGISTERED',
      registrationId: 'registration-9',
    });
    expect(execute.queries).toHaveLength(2);
  });

  it('stops instead of guessing when the duplicate check fails', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      new Error('permission denied'),
    ]);

    const outcome = await saveRegistration(REQUEST, { execute });

    expect(outcome.kind).toBe('FAILED');
    expect(execute.queries).toHaveLength(2);
  });

  it('reports a stored registration whose payment failed, and does not retry', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
      new Error('payment write failed'),
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 1500000 },
      { execute },
    );

    expect(outcome).toEqual({
      kind: 'REGISTERED_BUT_PAYMENT_FAILED',
      registrationId: 'registration-1',
      message: 'The registration is saved but the payment is not recorded.',
    });
    expect(execute.queries).toHaveLength(4);
  });

  it('reports a failed registration write as FAILED, not as success', async () => {
    const execute = createExecute([
      LEAD_RESPONSE,
      NO_REGISTRATION,
      new Error('insert rejected'),
    ]);

    expect((await saveRegistration(REQUEST, { execute })).kind).toBe('FAILED');
  });

  it('rejects a lead with no person before writing anything', async () => {
    const execute = createExecute([
      {
        eventLead: {
          id: 'lead-1',
          name: 'x',
          person: null,
          academyEvent: { id: 'event-1' },
        },
      },
    ]);

    expect(await saveRegistration(REQUEST, { execute })).toEqual({
      kind: 'REJECTED',
      reason: 'NO_PERSON_ON_LEAD',
    });
    expect(execute.queries).toHaveLength(1);
  });

  it('rejects an unsupported source object without touching the API', async () => {
    const execute = vi.fn();

    expect(
      await saveRegistration(
        { ...REQUEST, sourceObjectNameSingular: 'person' },
        { execute },
      ),
    ).toEqual({ kind: 'REJECTED', reason: 'SOURCE_NOT_FOUND' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('never writes to the sales interaction, so its history is untouched', async () => {
    const execute = createExecute([
      INTERACTION_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(
      {
        ...REQUEST,
        sourceObjectNameSingular: 'salesInteraction',
        sourceRecordId: 'interaction-1',
      },
      { execute },
    );

    const writes = execute.queries.filter((query) => query.startsWith('mutation'));

    expect(writes.every((query) => query.includes('createEventRegistration'))).toBe(
      true,
    );
    expect(writes.some((query) => query.includes('updateSalesInteraction'))).toBe(
      false,
    );
  });

  it('escapes the amount and identifiers it writes', async () => {
    const execute = createExecute([
      {
        eventLead: {
          id: 'lead-1',
          name: 'name with "quote"',
          person: { id: 'person-1' },
          academyEvent: { id: 'event-1' },
        },
      },
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(REQUEST, { execute });

    expect(execute.queries[2]).toContain('\\"quote\\"');
  });
});
