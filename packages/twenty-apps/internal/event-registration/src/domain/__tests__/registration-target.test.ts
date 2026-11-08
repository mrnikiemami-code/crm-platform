import { describe, expect, it } from 'vitest';

import { resolveRegistrationTarget } from 'src/domain/registration-target';

describe('resolveRegistrationTarget', () => {
  it('resolves when the lead carries a person and an event', () => {
    expect(
      resolveRegistrationTarget({
        id: 'lead-1',
        personId: 'person-1',
        eventId: 'event-1',
        name: 'سجاد قلعه',
      }),
    ).toEqual({
      kind: 'RESOLVED',
      leadId: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      leadName: 'سجاد قلعه',
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
      resolveRegistrationTarget({
        id: 'lead-1',
        personId: null,
        eventId: 'event-1',
        name: 'x',
      }),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'NO_PERSON_ON_LEAD' });

    expect(
      resolveRegistrationTarget({
        id: 'lead-1',
        personId: 'person-1',
        eventId: null,
        name: 'x',
      }),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'NO_EVENT_ON_LEAD' });
  });

  it('treats an empty identifier as absent rather than valid', () => {
    expect(
      resolveRegistrationTarget({
        id: 'lead-1',
        personId: '',
        eventId: 'event-1',
        name: null,
      }),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'NO_PERSON_ON_LEAD' });
  });
});
