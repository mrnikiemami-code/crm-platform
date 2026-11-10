import { describe, expect, it } from 'vitest';

import {
  readExistingRegistration,
  readInteractionHead,
  readLeadFromLeadResponse,
  readOperatorFromCurrentUser,
} from 'src/data/source-snapshot';

describe('readLeadFromLeadResponse', () => {
  it('reads the person, event and their labels', () => {
    expect(
      readLeadFromLeadResponse({
        eventLead: {
          id: 'lead-1',
          name: 'سجاد قلعه',
          person: { id: 'person-1', name: { firstName: 'سجاد', lastName: 'قلعه' } },
          academyEvent: { id: 'event-1', name: 'همایش آذر ماه' },
        },
      }),
    ).toEqual({
      id: 'lead-1',
      personId: 'person-1',
      eventId: 'event-1',
      name: 'سجاد قلعه',
      performedByName: null,
      personName: 'سجاد قلعه',
      eventName: 'همایش آذر ماه',
    });
  });

  it('returns null when the record is missing', () => {
    expect(readLeadFromLeadResponse({ eventLead: null })).toBeNull();
    expect(readLeadFromLeadResponse({})).toBeNull();
  });
});

describe('readInteractionHead', () => {
  it('reads the performer from the first level, and nothing nested', () => {    expect(
      readInteractionHead({
        salesInteraction: {
          id: 'interaction-1',
          eventLead: { id: 'lead-1', name: 'علیرضا عزیزی' },
          performedBy: {
            id: 'member-2',
            name: { firstName: 'ساغر', lastName: null },
          },
        },
      }),
    ).toEqual({
      leadId: 'lead-1',
      leadName: 'علیرضا عزیزی',
      performedByName: 'ساغر',
    });
  });

  it('joins a two-part performer name', () => {
    const head = readInteractionHead({
      salesInteraction: {
        eventLead: { id: 'lead-1' },
        performedBy: { name: { firstName: 'امیر', lastName: 'نصرتی' } },
      },
    });

    expect(head?.performedByName).toBe('امیر نصرتی');
  });

  it('reports no performer rather than an empty string', () => {
    const head = readInteractionHead({
      salesInteraction: {
        eventLead: { id: 'lead-1' },
        performedBy: null,
      },
    });

    expect(head?.performedByName).toBeNull();
  });

  it('reports an interaction with no lead instead of a lead with no person', () => {
    // These are different data states with different remedies.
    expect(
      readInteractionHead({
        salesInteraction: { id: 'interaction-1', eventLead: null },
      }),
    ).toEqual({ leadId: null, leadName: null, performedByName: null });

    expect(readInteractionHead({ salesInteraction: null })).toBeNull();
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
