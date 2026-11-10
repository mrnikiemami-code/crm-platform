import { describe, expect, it } from 'vitest';

import { resolveRegistrationTarget } from 'src/domain/registration-target';

const BASE = {
  id: 'lead-1',
  personId: 'person-1',
  eventId: 'event-1',
  name: 'سجاد قلعه',
  performedByName: null,
};

describe('resolveRegistrationTarget', () => {
  it('resolves when the lead carries a person and an event', () => {
    expect(resolveRegistrationTarget(BASE)).toEqual({
      kind: 'RESOLVED',
      leadId: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      leadName: 'سجاد قلعه',
      performedByName: null,
    });
  });

  it('carries the interaction performer through to the plan input', () => {
    expect(
      resolveRegistrationTarget({ ...BASE, performedByName: 'ساغر' }),
    ).toEqual({
      kind: 'RESOLVED',
      leadId: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      leadName: 'سجاد قلعه',
      performedByName: 'ساغر',
    });
  });

  it('reports a missing source record by name', () => {
    expect(resolveRegistrationTarget(null)).toEqual({
      kind: 'UNRESOLVED',
      reason: 'SOURCE_NOT_FOUND',
    });
  });

  it('separates a lead with no person from a lead with no event', () => {
    expect(
      resolveRegistrationTarget({ ...BASE, personId: null }),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'NO_PERSON_ON_LEAD' });

    expect(resolveRegistrationTarget({ ...BASE, eventId: null })).toEqual({
      kind: 'UNRESOLVED',
      reason: 'NO_EVENT_ON_LEAD',
    });
  });

  it('treats an empty identifier as absent rather than valid', () => {
    expect(
      resolveRegistrationTarget({ ...BASE, personId: '', name: null }),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'NO_PERSON_ON_LEAD' });
  });
});
