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
  it('restricts the four paths a member could use to reach a person', () => {
    expect(PREDICATES).toHaveLength(4);
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

  it('keeps object-level read/update, because the restriction is per row', () => {
    expect(assignedRecordsRole.config.canReadAllObjectRecords).toBe(true);
    expect(assignedRecordsRole.config.canUpdateAllObjectRecords).toBe(true);
  });

  it('can be assigned to a user', () => {
    expect(assignedRecordsRole.config.canBeAssignedToUsers).toBe(true);
  });
});
