import {
  evaluateQuotationDelete,
  evaluateQuotationLineMutation,
  evaluateQuotationLineReassignment,
  evaluateQuotationUpdate,
  resolveQuotationPermissionsFromRoleCapabilities,
} from 'src/modules/quotation/utils/quotation-immutability.util';

const ADMIN = resolveQuotationPermissionsFromRoleCapabilities({
  canUpdateAllObjectRecords: true,
  canUpdateAllSettings: false,
  canUpdateQuotationObject: true,
});

const EDITOR = resolveQuotationPermissionsFromRoleCapabilities({
  canUpdateAllObjectRecords: false,
  canUpdateAllSettings: false,
  canUpdateQuotationObject: true,
});

describe('quotation-immutability.util', () => {
  it('allows content edits on DRAFT for editors with version', () => {
    expect(
      evaluateQuotationUpdate({
        currentStatus: 'DRAFT',
        currentVersion: 1,
        patch: { name: 'new', totalExact: '1.000000', version: 1 },
        heldPermissions: EDITOR,
      }).ok,
    ).toBe(true);
  });

  it('refuses content edits on SENT even for admins', () => {
    const content = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      currentVersion: 2,
      patch: { name: 'mutated-after-sent', version: 2 },
      heldPermissions: ADMIN,
    });

    expect(content.ok).toBe(false);
    if (!content.ok) {
      expect(content.code).toBe('QUOTATION_IMMUTABLE');
    }
  });

  it('allows legal status transition only with the required permission', () => {
    const denied = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      currentVersion: 2,
      patch: { status: 'CUSTOMER_ACCEPTED', version: 2 },
      heldPermissions: EDITOR,
    });

    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe('PERMISSION_MISSING');
    }

    const allowed = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      currentVersion: 2,
      patch: { status: 'CUSTOMER_ACCEPTED', version: 2 },
      heldPermissions: ADMIN,
    });

    expect(allowed.ok).toBe(true);
  });

  it('ignores GraphQL updatedBy stamps so READY_TO_SEND can transition to SENT', () => {
    const decision = evaluateQuotationUpdate({
      currentStatus: 'READY_TO_SEND',
      currentVersion: 3,
      patch: {
        status: 'SENT',
        version: 3,
        updatedBy: {
          source: 'API',
          name: 'test',
          workspaceMemberId: null,
          context: {},
        },
      },
      heldPermissions: ADMIN,
    });

    expect(decision.ok).toBe(true);
  });

  it('refuses approve/send/cancel for object-only editors', () => {
    expect(
      evaluateQuotationUpdate({
        currentStatus: 'READY_TO_SEND',
        currentVersion: 1,
        patch: { status: 'SENT', version: 1 },
        heldPermissions: EDITOR,
      }).ok,
    ).toBe(false);

    expect(
      evaluateQuotationUpdate({
        currentStatus: 'DRAFT',
        currentVersion: 1,
        patch: { status: 'CANCELLED', version: 1 },
        heldPermissions: EDITOR,
      }).ok,
    ).toBe(false);
  });

  it('requires matching version to prevent concurrent overwrite', () => {
    const missing = evaluateQuotationUpdate({
      currentStatus: 'DRAFT',
      currentVersion: 3,
      patch: { name: 'x' },
      heldPermissions: EDITOR,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.code).toBe('QUOTATION_VERSION_REQUIRED');
    }

    const conflict = evaluateQuotationUpdate({
      currentStatus: 'DRAFT',
      currentVersion: 3,
      patch: { name: 'x', version: 2 },
      heldPermissions: EDITOR,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe('QUOTATION_VERSION_CONFLICT');
    }

    const unreadStoredVersion = evaluateQuotationUpdate({
      currentStatus: 'DRAFT',
      currentVersion: null,
      patch: { name: 'x', version: 1 },
      heldPermissions: EDITOR,
    });
    expect(unreadStoredVersion.ok).toBe(false);
    if (!unreadStoredVersion.ok) {
      expect(unreadStoredVersion.code).toBe('QUOTATION_VERSION_CONFLICT');
    }
  });

  it('blocks moving a line between quotations', () => {
    const decision = evaluateQuotationLineReassignment({
      currentQuotationId: 'q-1',
      nextQuotationId: 'q-2',
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('QUOTATION_LINE_REASSIGN_FORBIDDEN');
    }
  });

  it('freezes lines once past internal editing', () => {
    expect(
      evaluateQuotationLineMutation({
        parentStatus: 'SENT',
        heldPermissions: ADMIN,
      }).ok,
    ).toBe(false);
    expect(
      evaluateQuotationLineMutation({
        parentStatus: 'DRAFT',
        heldPermissions: EDITOR,
      }).ok,
    ).toBe(true);
  });

  it('refuses delete of a sent quotation', () => {
    const decision = evaluateQuotationDelete({
      currentStatus: 'SENT',
      heldPermissions: ADMIN,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('QUOTATION_IMMUTABLE');
    }
  });
});
