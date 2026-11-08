import { describe, expect, it } from 'vitest';

import {
  readExistingRegistration,
  readLeadFromInteractionResponse,
  readLeadFromLeadResponse,
} from 'src/data/source-snapshot';

describe('readLeadFromLeadResponse', () => {
  it('reads the person and event relations', () => {
    expect(
      readLeadFromLeadResponse({
        eventLead: {
          id: 'lead-1',
          name: 'سجاد قلعه',
          person: { id: 'person-1' },
          academyEvent: { id: 'event-1' },
        },
      }),
    ).toEqual({
      id: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      name: 'سجاد قلعه',
    });
  });

  it('returns null when the record is missing', () => {
    expect(readLeadFromLeadResponse({ eventLead: null })).toBeNull();
    expect(readLeadFromLeadResponse({})).toBeNull();
  });
});

describe('readLeadFromInteractionResponse', () => {
  it('reads the lead the interaction belongs to', () => {
    expect(
      readLeadFromInteractionResponse({
        salesInteraction: {
          id: 'interaction-1',
          eventLead: {
            id: 'lead-1',
            name: 'x',
            person: { id: 'person-1' },
            academyEvent: { id: 'event-1' },
          },
        },
      }),
    ).toEqual({
      id: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      name: 'x',
    });
  });

  it('distinguishes an interaction with no lead from a missing interaction', () => {
    expect(
      readLeadFromInteractionResponse({
        salesInteraction: { id: 'interaction-1', eventLead: null },
      }),
    ).toEqual({ id: null, personId: null, eventId: null, name: null });

    expect(readLeadFromInteractionResponse({ salesInteraction: null })).toBeNull();
  });
});

describe('readExistingRegistration', () => {
  it('returns the first registration in the connection', () => {
    expect(
      readExistingRegistration({
        eventRegistrations: {
          edges: [{ node: { id: 'registration-1', registrationStatus: 'PYSHTHBTNM' } }],
        },
      }),
    ).toEqual({ id: 'registration-1', registrationStatus: 'PYSHTHBTNM' });
  });

  it('returns null for an empty connection', () => {
    expect(
      readExistingRegistration({ eventRegistrations: { edges: [] } }),
    ).toBeNull();
  });

  it('returns null when the shape is not a connection', () => {
    expect(readExistingRegistration({})).toBeNull();
    expect(readExistingRegistration({ eventRegistrations: null })).toBeNull();
  });
});
