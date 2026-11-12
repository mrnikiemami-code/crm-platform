import { describe, expect, it, vi } from 'vitest';

import { saveRegistration } from 'src/services/save-registration.service';

const OPERATOR = {
  currentUser: {
    workspaceMember: {
      id: 'member-1',
      name: { firstName: 'امیر', lastName: 'نصرتی' },
      userWorkspaceId: 'uw-1',
    },
  },
};

const LEAD_RESPONSE = {
  eventLead: {
    id: 'lead-1',
    name: 'مهران صالحپور',
    person: {
      id: 'person-1',
      name: { firstName: 'مهران', lastName: 'صالحپور' },
    },
    academyEvent: { id: 'event-1', name: 'همایش آذر ماه' },
  },
};

// First level only: this is everything the interaction query may read.
const INTERACTION_HEAD = {
  salesInteraction: {
    id: 'interaction-1',
    eventLead: { id: 'lead-1', name: 'مهران صالحپور' },
    performedBy: { id: 'member-2', name: { firstName: 'ساغر', lastName: '' } },
  },
};

const NO_REGISTRATION = { eventRegistrations: { edges: [] } };

const REQUEST = {
  sourceObjectNameSingular: 'eventLead',
  sourceRecordId: 'lead-1',
  registrationStatus: 'PYSHTHBTNM',
  agreedAmountToman: 3900000,
  paidAmountToman: 0,
  operatorUserWorkspaceId: 'uw-1',
};

const INTERACTION_REQUEST = {
  ...REQUEST,
  sourceObjectNameSingular: 'salesInteraction',
  sourceRecordId: 'interaction-1',
};

const FIXED_NOW = new Date('2026-11-10T12:30:00.000Z');

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

const deps = (
  execute: (query: string) => Promise<Record<string, unknown>>,
) => ({
  execute,
  now: () => FIXED_NOW,
});

describe('saveRegistration', () => {
  it('registers a lead without creating a payment row', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    const outcome = await saveRegistration(REQUEST, deps(execute));

    expect(outcome).toEqual({
      kind: 'CREATED',
      registrationId: 'registration-1',
      paymentId: null,
    });
    expect(execute.queries).toHaveLength(4);
    expect(
      execute.queries.some((query) =>
        query.includes('createRegistrationPayment'),
      ),
    ).toBe(false);
  });

  it('attributes the seller to the signed-in operator and stamps the server time', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(REQUEST, deps(execute));

    const create = execute.queries[3];

    expect(create).toContain('soldByRaw: "امیر نصرتی"');
    expect(create).toContain('registeredAt: "2026-11-10T12:30:00.000Z"');
  });

  it('reads an interaction in two steps and uses its performer as seller', async () => {
    const execute = createExecute([
      OPERATOR,
      INTERACTION_HEAD,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    const outcome = await saveRegistration(INTERACTION_REQUEST, deps(execute));

    expect(outcome.kind).toBe('CREATED');
    // The interaction query reads ONLY the first level, never a nested person.
    expect(execute.queries[1]).toContain('salesInteraction');
    expect(execute.queries[1]).not.toContain('person');
    // The lead is then read directly, which is the shape the server supports.
    expect(execute.queries[2]).toContain('eventLead');
    expect(execute.queries[4]).toContain('soldByRaw: "ساغر"');
    expect(execute.queries[4]).toContain('person-1');
    expect(execute.queries[4]).toContain('event-1');
  });

  it('reports an interaction that points at no lead by name', async () => {
    const execute = createExecute([
      OPERATOR,
      { salesInteraction: { id: 'interaction-1', eventLead: null } },
    ]);

    expect(await saveRegistration(INTERACTION_REQUEST, deps(execute))).toEqual({
      kind: 'REJECTED',
      reason: 'NO_LEAD_FOR_INTERACTION',
    });
    expect(execute.queries).toHaveLength(2);
  });

  it('registers a lead and records the payment with the same seller', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
      { createRegistrationPayment: { id: 'payment-1' } },
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 1500000 },
      deps(execute),
    );

    expect(outcome).toEqual({
      kind: 'CREATED',
      registrationId: 'registration-1',
      paymentId: 'payment-1',
    });
    expect(execute.queries[4]).toContain('1500000');
    expect(execute.queries[4]).toContain('registration-1');
    expect(execute.queries[4]).toContain('soldByRaw: "امیر نصرتی"');
    expect(execute.queries[4]).toContain(
      'name: "پرداخت ۱٬۵۰۰٬۰۰۰ تومان — مهران صالحپور — همایش آذر ماه"',
    );
  });

  it('stores a readable Persian title on the registration itself', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(REQUEST, deps(execute));

    expect(execute.queries[3]).toContain(
      'name: "ثبت‌نام مهران صالحپور در همایش آذر ماه"',
    );
  });

  it('writes nothing when a registration already exists', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      { eventRegistrations: { edges: [{ node: { id: 'registration-9' } }] } },
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 5000000 },
      deps(execute),
    );

    expect(outcome).toEqual({
      kind: 'ALREADY_REGISTERED',
      registrationId: 'registration-9',
    });
    expect(execute.queries).toHaveLength(3);
  });

  describe('operator gate', () => {
    it('refuses when the platform reports no signed-in member', async () => {
      const execute = createExecute([{ currentUser: null }]);

      const outcome = await saveRegistration(
        { ...REQUEST, operatorUserWorkspaceId: null },
        deps(execute),
      );

      expect(outcome).toEqual({
        kind: 'REJECTED',
        reason: 'OPERATOR_CONTEXT_MISSING',
      });
      // Only the identity probe ran; no business record was touched.
      expect(execute.queries).toHaveLength(1);
    });

    it('treats a missing runtime id as normal and resolves from the session', async () => {
      const execute = createExecute([
        OPERATOR,
        LEAD_RESPONSE,
        { eventRegistrations: { edges: [] } },
        { createEventRegistration: { id: 'registration-1' } },
        { createRegistrationPayment: { id: 'payment-1' } },
      ]);

      const outcome = await saveRegistration(
        { ...REQUEST, operatorUserWorkspaceId: null, paidAmountToman: 5000000 },
        deps(execute),
      );

      expect(outcome).toEqual({
        kind: 'CREATED',
        registrationId: 'registration-1',
        paymentId: 'payment-1',
      });
    });

    it('refuses when the request cannot produce a user (application-only context)', async () => {
      const execute = createExecute([new Error('FORBIDDEN')]);

      const outcome = await saveRegistration(REQUEST, deps(execute));

      expect(outcome).toEqual({
        kind: 'REJECTED',
        reason: 'OPERATOR_CONTEXT_MISSING',
      });
      expect(
        execute.queries.some((query) => query.startsWith('mutation')),
      ).toBe(false);
    });

    it('refuses when the response carries no workspace member', async () => {
      const execute = createExecute([
        { currentUser: { workspaceMember: null } },
      ]);

      expect(await saveRegistration(REQUEST, deps(execute))).toEqual({
        kind: 'REJECTED',
        reason: 'OPERATOR_CONTEXT_MISSING',
      });
    });

    it('refuses when the session user does not match the runtime operator', async () => {
      const execute = createExecute([
        {
          currentUser: {
            workspaceMember: {
              id: 'member-1',
              name: { firstName: 'کسی', lastName: 'دیگر' },
              userWorkspaceId: 'uw-OTHER',
            },
          },
        },
      ]);

      const outcome = await saveRegistration(REQUEST, deps(execute));

      expect(outcome).toEqual({
        kind: 'REJECTED',
        reason: 'OPERATOR_MISMATCH',
      });
      expect(execute.queries).toHaveLength(1);
    });
  });

  it('stops instead of guessing when the duplicate check fails', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      new Error('permission denied'),
    ]);

    const outcome = await saveRegistration(REQUEST, deps(execute));

    expect(outcome.kind).toBe('FAILED');
    expect(execute.queries).toHaveLength(3);
  });

  it('reports a stored registration whose payment failed, and does not retry', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
      new Error('payment write failed'),
    ]);

    const outcome = await saveRegistration(
      { ...REQUEST, paidAmountToman: 1500000 },
      deps(execute),
    );

    expect(outcome).toEqual({
      kind: 'REGISTERED_BUT_PAYMENT_FAILED',
      registrationId: 'registration-1',
      message: 'The registration is saved but the payment is not recorded.',
    });
    expect(execute.queries).toHaveLength(5);
  });

  it('reports a failed registration write as FAILED, not as success', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      new Error('insert rejected'),
    ]);

    expect((await saveRegistration(REQUEST, deps(execute))).kind).toBe(
      'FAILED',
    );
  });

  it('rejects a lead with no person before writing anything', async () => {
    const execute = createExecute([
      OPERATOR,
      {
        eventLead: {
          id: 'lead-1',
          name: 'x',
          person: null,
          academyEvent: { id: 'event-1' },
        },
      },
    ]);

    expect(await saveRegistration(REQUEST, deps(execute))).toEqual({
      kind: 'REJECTED',
      reason: 'NO_PERSON_ON_LEAD',
    });
    expect(execute.queries).toHaveLength(2);
  });

  it('rejects an unsupported source object without reading business data', async () => {
    const execute = createExecute([OPERATOR]);

    expect(
      await saveRegistration(
        { ...REQUEST, sourceObjectNameSingular: 'person' },
        deps(execute),
      ),
    ).toEqual({ kind: 'REJECTED', reason: 'SOURCE_NOT_FOUND' });
    expect(execute.queries).toHaveLength(1);
  });

  it('never writes to the sales interaction, so its history is untouched', async () => {
    const execute = createExecute([
      OPERATOR,
      INTERACTION_HEAD,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(INTERACTION_REQUEST, deps(execute));

    const writes = execute.queries.filter((query) =>
      query.startsWith('mutation'),
    );

    expect(
      writes.every((query) => query.includes('createEventRegistration')),
    ).toBe(true);
    expect(
      writes.some((query) => query.includes('updateSalesInteraction')),
    ).toBe(false);
  });

  it('escapes the amount and identifiers it writes', async () => {
    const execute = createExecute([
      OPERATOR,
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

    await saveRegistration(REQUEST, deps(execute));

    expect(execute.queries[3]).toContain('\\"quote\\"');
  });

  it('leaves soldByRaw unset rather than inventing a seller', async () => {
    const execute = createExecute([
      {
        currentUser: {
          workspaceMember: {
            id: 'member-1',
            name: { firstName: null, lastName: null },
            userWorkspaceId: 'uw-1',
          },
        },
      },
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    await saveRegistration(REQUEST, deps(execute));

    expect(execute.queries[3]).toContain('soldByRaw: null');
  });

  it('uses the injected clock, so the timestamp is the server’s', async () => {
    const execute = createExecute([
      OPERATOR,
      LEAD_RESPONSE,
      NO_REGISTRATION,
      { createEventRegistration: { id: 'registration-1' } },
    ]);

    const now = vi.fn(() => FIXED_NOW);

    await saveRegistration(REQUEST, { execute, now });

    expect(now).toHaveBeenCalledTimes(1);
    expect(execute.queries[3]).toContain(FIXED_NOW.toISOString());
  });
});
