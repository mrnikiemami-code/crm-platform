import { describe, expect, it } from 'vitest';

import {
  EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER,
  EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER,
  WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import assignedRecordsRole from 'src/roles/assigned-records.role';

const PREDICATES = assignedRecordsRole.config.rowLevelPermissionPredicates ?? [];

describe('assigned-records role', () => {
  it('restricts every path a member could use to reach a customer', () => {
    expect(PREDICATES).toHaveLength(5);
  });

  it('binds every predicate to the acting member, never to a fixed id', () => {
    for (const predicate of PREDICATES) {
      expect(predicate.workspaceMemberFieldUniversalIdentifier).toBe(
        WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
      );
      // A hard-coded principal id would freeze access to one person's records.
      expect(predicate.value ?? null).toBeNull();
    }
  });

  it('compares each object to its own assignment field', () => {
    const fieldByObject = new Map(
      PREDICATES.map((predicate) => [
        predicate.objectUniversalIdentifier,
        predicate.fieldUniversalIdentifier,
      ]),
    );

    expect(
      fieldByObject.get(
        '20202020-e674-48e5-a542-72570eee7213',
      ),
    ).toBe(PERSON_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER);

    expect(fieldByObject.get('8b0406f5-f10d-499d-8f81-0994bd10c05f')).toBe(
      EVENT_LEAD_ASSIGNED_TO_FIELD_UNIVERSAL_IDENTIFIER,
    );

    expect(
      fieldByObject.get(
        '2fb53fae-1866-4c38-a37a-0aa8d4797c57',
      ),
    ).toBe(EVENT_REGISTRATION_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER);

    expect(
      fieldByObject.get(
        '020a3694-c0fc-4dfb-b108-efad91ced90d',
      ),
    ).toBe(REGISTRATION_PAYMENT_ASSIGNEE_FIELD_UNIVERSAL_IDENTIFIER);
  });

  it('uses the equality operand, so an unassigned record matches nobody', () => {
    for (const predicate of PREDICATES) {
      expect(predicate.operand).toBe('IS');
    }
  });

  it('never grants deletion or settings access', () => {
    expect(assignedRecordsRole.config.canDestroyAllObjectRecords).toBe(false);
    expect(assignedRecordsRole.config.canSoftDeleteAllObjectRecords).toBe(false);
    expect(assignedRecordsRole.config.canUpdateAllSettings).toBe(false);
    expect(assignedRecordsRole.config.canAccessAllTools).toBe(false);
  });

  it('denies by default at the object level', () => {
    // Both flags OFF: an object that is not listed in objectPermissions is not
    // reachable by this role at all.
    expect(assignedRecordsRole.config.canReadAllObjectRecords).toBe(false);
    expect(assignedRecordsRole.config.canUpdateAllObjectRecords).toBe(false);
  });

  it('grants read+update only on the customer objects, per row', () => {
    const permissive = (assignedRecordsRole.config.objectPermissions ?? [])
      .filter((permission) => permission.canReadObjectRecords !== false)
      .map((permission) => permission.objectUniversalIdentifier);

    expect(permissive).toHaveLength(7);
    expect(permissive).toEqual(
      expect.arrayContaining([
        '20202020-e674-48e5-a542-72570eee7213', // person
        '8b0406f5-f10d-499d-8f81-0994bd10c05f', // eventLead
        '2fb53fae-1866-4c38-a37a-0aa8d4797c57', // eventRegistration
        '020a3694-c0fc-4dfb-b108-efad91ced90d', // registrationPayment
        '51187b43-d919-4c5e-aebf-b95c89d02f06', // salesInteraction
      ]),
    );
  });

  it('denies the system objects that carry customer data explicitly', () => {
    const denied = (assignedRecordsRole.config.objectPermissions ?? [])
      .filter((permission) => permission.canReadObjectRecords === false)
      .map((permission) => permission.objectUniversalIdentifier);

    // A system object defaults to readable, so these must be named.
    expect(denied).toHaveLength(6);
    expect(denied).toEqual(
      expect.arrayContaining([
        '20202020-bd3d-4c60-8dca-571c71d4447a', // attachment
        '20202020-fff0-4b44-be82-bda313884400', // noteTarget
        '20202020-5a9a-44e8-95df-771cd06d0fb1', // taskTarget
        '20202020-6736-4337-b5c4-8b39fae325a5', // timelineActivity
        '20202020-a1c3-47a6-9732-27e5b1e8436d', // calendarEventParticipant
        '20202020-a433-4456-aa2d-fd9cb26b774a', // messageParticipant
      ]),
    );
  });

  it('restricts the sales interaction, which carries the customer name', () => {
    const interaction = PREDICATES.find(
      (predicate) =>
        predicate.objectUniversalIdentifier ===
        '51187b43-d919-4c5e-aebf-b95c89d02f06',
    );

    expect(interaction).toBeDefined();
    expect(interaction?.workspaceMemberFieldUniversalIdentifier).toBe(
      WORKSPACE_MEMBER_ID_FIELD_UNIVERSAL_IDENTIFIER,
    );
  });

  it('can be assigned to a user', () => {
    expect(assignedRecordsRole.config.canBeAssignedToUsers).toBe(true);
  });
});
