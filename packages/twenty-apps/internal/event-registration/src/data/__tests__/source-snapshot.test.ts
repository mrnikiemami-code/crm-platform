import { describe, expect, it } from 'vitest';

import {
  readExistingRegistration,
  readLeadFromInteractionResponse,
  readLeadFromLeadResponse,
  readOperatorFromCurrentUser,
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
      performedByName: null,
    });
  });

  it('returns null when the record is missing', () => {
    expect(readLeadFromLeadResponse({ eventLead: null })).toBeNull();
    expect(readLeadFromLeadResponse({})).toBeNull();
  });
});

describe('readLeadFromInteractionResponse', () => {
  it('reads the lead the interaction belongs to, and its performer', () => {
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
          performedBy: {
            id: 'member-2',
            name: { firstName: 'ساغر', lastName: null },
          },
        },
      }),
    ).toEqual({
      id: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      name: 'x',
      performedByName: 'ساغر',
    });
  });

  it('joins a two-part performer name', () => {
    const snapshot = readLeadFromInteractionResponse({
      salesInteraction: {
        eventLead: { id: 'lead-1', person: { id: 'p' }, academyEvent: { id: 'e' } },
        performedBy: {
          name: { firstName: 'امیر', lastName: 'نصرتی' },
        },
      },
    });

    expect(snapshot?.performedByName).toBe('امیر نصرتی');
  });

  it('reports no performer rather than an empty string', () => {
    const snapshot = readLeadFromInteractionResponse({
      salesInteraction: {
        eventLead: { id: 'lead-1', person: { id: 'p' }, academyEvent: { id: 'e' } },
        performedBy: null,
      },
    });

    expect(snapshot?.performedByName).toBeNull();
  });

  it('distinguishes an interaction with no lead from a missing interaction', () => {
    expect(
      readLeadFromInteractionResponse({
        salesInteraction: { id: 'interaction-1', eventLead: null },
      }),
    ).toEqual({
      id: null,
      personId: null,
      eventId: null,
      name: null,
      performedByName: null,
    });

    expect(
      readLeadFromInteractionResponse({ salesInteraction: null }),
    ).toBeNull();
  });
});

describe('readExistingRegistration', () => {
  it('returns the first registration in the connection', () => {
    expect(
      readExistingRegistration({
        eventRegistrations: {
          edges: [
            { node: { id: 'registration-1', registrationStatus: 'PYSHTHBTNM' } },
          ],
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

describe('readOperatorFromCurrentUser', () => {
  it('reads the signed-in operator', () => {
    expect(
      readOperatorFromCurrentUser({
        currentUser: {
          workspaceMember: {
            id: 'member-1',
            name: { firstName: 'امیر', lastName: 'نصرتی' },
            userWorkspaceId: 'uw-1',
          },
        },
      }),
    ).toEqual({
      workspaceMemberId: 'member-1',
      userWorkspaceId: 'uw-1',
      displayName: 'امیر نصرتی',
    });
  });

  it('returns null when there is no user at all (application-only request)', () => {
    expect(readOperatorFromCurrentUser({ currentUser: null })).toBeNull();
    expect(readOperatorFromCurrentUser({})).toBeNull();
  });

  it('reports a missing member id instead of inventing one', () => {
    expect(
      readOperatorFromCurrentUser({
        currentUser: { workspaceMember: { name: { firstName: 'x' } } },
      }),
    ).toEqual({
      workspaceMemberId: null,
      userWorkspaceId: null,
      displayName: 'x',
    });
  });
});
