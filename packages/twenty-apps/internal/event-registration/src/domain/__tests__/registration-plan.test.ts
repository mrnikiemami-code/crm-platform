import { describe, expect, it } from 'vitest';

import { decideRegistrationPlan } from 'src/domain/registration-plan';
import { type RegistrationTarget } from 'src/domain/registration-target';

const TARGET: Extract<RegistrationTarget, { kind: 'RESOLVED' }> = {
  kind: 'RESOLVED',
  leadId: 'lead-1',
  personId: 'person-1',
  eventId: 'event-1',
  leadName: 'مهران صالحپور',
};

const REQUEST = {
  registrationStatus: 'PYSHTHBTNM',
  agreedAmountToman: 3900000,
  paidAmountToman: 0,
};

describe('decideRegistrationPlan', () => {
  it('creates the registration and NO payment when nothing was received', () => {
    const plan = decideRegistrationPlan(TARGET, REQUEST, null);

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration).toEqual({
      eventLeadId: 'lead-1',
      personId: 'person-1',
      academyEventId: 'event-1',
      registrationStatus: 'PYSHTHBTNM',
      finalAmountToman: 3900000,
      name: 'مهران صالحپور',
    });
    expect(plan.payment).toBeNull();
  });

  it('creates the payment when money was received', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, paidAmountToman: 1500000 },
      null,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.payment).toEqual({ amountToman: 1500000 });
  });

  it('reports an existing registration instead of creating a duplicate', () => {
    expect(decideRegistrationPlan(TARGET, REQUEST, 'registration-9')).toEqual({
      kind: 'ALREADY_REGISTERED',
      registrationId: 'registration-9',
    });
  });

  it('never proposes a payment for an already registered lead', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, paidAmountToman: 5000000 },
      'registration-9',
    );

    expect(plan.kind).toBe('ALREADY_REGISTERED');
  });

  it('accepts both offered statuses', () => {
    for (const status of ['PYSHTHBTNM', 'THBTNM_QTAAY']) {
      const plan = decideRegistrationPlan(
        TARGET,
        { ...REQUEST, registrationStatus: status },
        null,
      );

      expect(plan.kind).toBe('CREATE');
    }
  });

  it('rejects a status the form does not offer', () => {
    expect(
      decideRegistrationPlan(
        TARGET,
        { ...REQUEST, registrationStatus: 'LGWSHDH' },
        null,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'STATUS_NOT_OFFERED' });
  });

  it('rejects a malformed amount instead of reading it as zero', () => {
    expect(
      decideRegistrationPlan(
        TARGET,
        { ...REQUEST, agreedAmountToman: Number.NaN },
        null,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'AMOUNT_NOT_A_NUMBER' });
  });

  it('rejects a negative amount', () => {
    expect(
      decideRegistrationPlan(
        TARGET,
        { ...REQUEST, paidAmountToman: -1 },
        null,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'AMOUNT_NEGATIVE' });
  });

  it('keeps an absent agreed amount absent rather than defaulting it to zero', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, agreedAmountToman: null },
      null,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.finalAmountToman).toBeNull();
  });
});
