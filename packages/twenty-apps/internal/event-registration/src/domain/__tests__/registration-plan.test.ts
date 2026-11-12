import { describe, expect, it } from 'vitest';

import { decideRegistrationPlan } from 'src/domain/registration-plan';
import { type RegistrationTarget } from 'src/domain/registration-target';

const TARGET: Extract<RegistrationTarget, { kind: 'RESOLVED' }> = {
  kind: 'RESOLVED',
  leadId: 'lead-1',
  personId: 'person-1',
  eventId: 'event-1',
  leadName: 'مهران صالحپور',
  personName: 'مهران صالحپور',
  eventName: 'همایش آذر ماه',
  performedByName: null,
};

const REQUEST = {
  registrationStatus: 'PYSHTHBTNM',
  agreedAmountToman: 3900000,
  paidAmountToman: 0,
};

const CONTEXT = {
  registeredAtIso: '2026-11-10T12:30:00.000Z',
  sellerName: 'امیر نصرتی',
};

describe('decideRegistrationPlan', () => {
  it('creates the registration and NO payment when nothing was received', () => {
    const plan = decideRegistrationPlan(TARGET, REQUEST, null, CONTEXT);

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
      name: 'ثبت‌نام مهران صالحپور در همایش آذر ماه',
      soldByRaw: 'امیر نصرتی',
      registeredAt: '2026-11-10T12:30:00.000Z',
    });
    expect(plan.payment).toBeNull();
  });

  it('creates the payment when money was received, with the same seller', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, paidAmountToman: 1500000 },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.payment).toEqual({
      amountToman: 1500000,
      name: 'پرداخت ۱٬۵۰۰٬۰۰۰ تومان — مهران صالحپور — همایش آذر ماه',
      soldByRaw: 'امیر نصرتی',
    });
  });

  it('attributes to the interaction performer when the source carries one', () => {
    const plan = decideRegistrationPlan(
      { ...TARGET, performedByName: 'ساغر' },
      { ...REQUEST, paidAmountToman: 1500000 },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.soldByRaw).toBe('ساغر');
    expect(plan.payment?.soldByRaw).toBe('ساغر');
  });

  it('leaves the seller unset when no authoritative name exists', () => {
    const plan = decideRegistrationPlan(TARGET, REQUEST, null, {
      registeredAtIso: CONTEXT.registeredAtIso,
      sellerName: null,
    });

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.soldByRaw).toBeNull();
  });

  it('reports an existing registration instead of creating a duplicate', () => {
    expect(
      decideRegistrationPlan(TARGET, REQUEST, 'registration-9', CONTEXT),
    ).toEqual({
      kind: 'ALREADY_REGISTERED',
      registrationId: 'registration-9',
    });
  });

  it('never proposes a payment for an already registered lead', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, paidAmountToman: 5000000 },
      'registration-9',
      CONTEXT,
    );

    expect(plan.kind).toBe('ALREADY_REGISTERED');
  });

  it('accepts both offered statuses', () => {
    for (const status of ['PYSHTHBTNM', 'THBTNM_QTAAY']) {
      const plan = decideRegistrationPlan(
        TARGET,
        { ...REQUEST, registrationStatus: status },
        null,
        CONTEXT,
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
        CONTEXT,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'STATUS_NOT_OFFERED' });
  });

  it('rejects a malformed amount instead of reading it as zero', () => {
    expect(
      decideRegistrationPlan(
        TARGET,
        { ...REQUEST, agreedAmountToman: Number.NaN },
        null,
        CONTEXT,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'AMOUNT_NOT_A_NUMBER' });
  });

  it('rejects a negative amount', () => {
    expect(
      decideRegistrationPlan(
        TARGET,
        { ...REQUEST, paidAmountToman: -1 },
        null,
        CONTEXT,
      ),
    ).toEqual({ kind: 'INVALID', reason: 'AMOUNT_NEGATIVE' });
  });

  it('keeps an absent agreed amount absent rather than defaulting it to zero', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      { ...REQUEST, agreedAmountToman: null },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.finalAmountToman).toBeNull();
  });

  it('stores 125,000 exactly as agreed and paid', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      {
        registrationStatus: 'THBTNM_QTAAY',
        agreedAmountToman: 125000,
        paidAmountToman: 125000,
      },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.finalAmountToman).toBe(125000);
    expect(plan.registration.name).toBe(
      'ثبت‌نام مهران صالحپور در همایش آذر ماه',
    );
    expect(plan.payment).toEqual({
      amountToman: 125000,
      name: 'پرداخت ۱۲۵٬۰۰۰ تومان — مهران صالحپور — همایش آذر ماه',
      soldByRaw: 'امیر نصرتی',
    });
  });

  it('records 125,000 agreed with NO payment when nothing was received', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      {
        registrationStatus: 'THBTNM_QTAAY',
        agreedAmountToman: 125000,
        paidAmountToman: 0,
      },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.registration.finalAmountToman).toBe(125000);
    expect(plan.payment).toBeNull();
  });

  it('does not turn a payment of 125,000 into 12,500,000', () => {
    const plan = decideRegistrationPlan(
      TARGET,
      {
        registrationStatus: 'THBTNM_QTAAY',
        agreedAmountToman: 125000,
        paidAmountToman: 125000,
      },
      null,
      CONTEXT,
    );

    expect(plan.kind).toBe('CREATE');

    if (plan.kind !== 'CREATE') {
      return;
    }

    expect(plan.payment?.amountToman).toBe(125000);
    expect(plan.payment?.amountToman).not.toBe(12500000);
  });
});
