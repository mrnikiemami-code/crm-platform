// Server-side mirror of the quotation app domain freeze + transition rules.
//
// WHY DUPLICATED HERE: GraphQL mutations bypass app HTTP routes. Immutability and
// privileged status changes must be enforced in workspace query hooks, and
// twenty-server must not import twenty-apps. Keep aligned with
// packages/twenty-apps/internal/quotation/src/domain/quotation/{status,transitions}.ts.

export const QUOTATION_CONTENT_MUTABLE_STATUSES = [
  'DRAFT',
  'PENDING_INTERNAL_APPROVAL',
] as const;

export const QUOTATION_TERMINAL_STATUSES = [
  'CUSTOMER_REJECTED',
  'EXPIRED',
  'CANCELLED',
  'CONVERTED',
] as const;

export const QUOTATION_PERMISSIONS = [
  'quotation.edit',
  'quotation.submitForApproval',
  'quotation.approve',
  'quotation.send',
  'quotation.recordCustomerDecision',
  'quotation.cancel',
  'quotation.convertToInvoice',
  'quotation.expire',
] as const;

export type QuotationPermission = (typeof QUOTATION_PERMISSIONS)[number];

// Fields that may still change after content freeze (lifecycle only).
export const QUOTATION_LIFECYCLE_FIELD_NAMES = new Set([
  'status',
  'sentAt',
  'decidedAt',
  'expiresAt',
]);

// GraphQL updateOne always stamps actor metadata; that must not freeze lifecycle
// transitions (READY_TO_SEND -> SENT, customer decision, cancel, …).
export const QUOTATION_SYSTEM_FIELD_NAMES = new Set([
  'updatedBy',
  'createdBy',
]);

type QuotationTransition = {
  from: string;
  to: string;
  requiredPermission: QuotationPermission;
};

const LEGAL_TRANSITIONS: readonly QuotationTransition[] = [
  {
    from: 'DRAFT',
    to: 'PENDING_INTERNAL_APPROVAL',
    requiredPermission: 'quotation.submitForApproval',
  },
  {
    from: 'PENDING_INTERNAL_APPROVAL',
    to: 'DRAFT',
    requiredPermission: 'quotation.approve',
  },
  {
    from: 'PENDING_INTERNAL_APPROVAL',
    to: 'READY_TO_SEND',
    requiredPermission: 'quotation.approve',
  },
  {
    from: 'READY_TO_SEND',
    to: 'SENT',
    requiredPermission: 'quotation.send',
  },
  {
    from: 'SENT',
    to: 'CUSTOMER_ACCEPTED',
    requiredPermission: 'quotation.recordCustomerDecision',
  },
  {
    from: 'SENT',
    to: 'CUSTOMER_REJECTED',
    requiredPermission: 'quotation.recordCustomerDecision',
  },
  {
    from: 'SENT',
    to: 'EXPIRED',
    requiredPermission: 'quotation.expire',
  },
  {
    from: 'CUSTOMER_ACCEPTED',
    to: 'CONVERTED',
    requiredPermission: 'quotation.convertToInvoice',
  },
  ...(['DRAFT', 'PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND', 'SENT'] as const).map(
    (from): QuotationTransition => ({
      from,
      to: 'CANCELLED',
      requiredPermission: 'quotation.cancel',
    }),
  ),
];

export type QuotationImmutabilityDecision =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const canEditQuotationContent = (status: string): boolean =>
  (QUOTATION_CONTENT_MUTABLE_STATUSES as readonly string[]).includes(status);

export const isQuotationStatusTerminal = (status: string): boolean =>
  (QUOTATION_TERMINAL_STATUSES as readonly string[]).includes(status);

export const findQuotationTransition = (
  from: string,
  to: string,
): QuotationTransition | undefined =>
  LEGAL_TRANSITIONS.find(
    (transition) => transition.from === from && transition.to === to,
  );

export const isLegalQuotationTransition = (
  from: string,
  to: string,
): boolean => findQuotationTransition(from, to) !== undefined;

export const evaluateQuotationUpdate = ({
  currentStatus,
  currentVersion,
  patch,
  heldPermissions,
}: {
  currentStatus: string;
  currentVersion: number | null;
  patch: Record<string, unknown>;
  heldPermissions: readonly QuotationPermission[];
}): QuotationImmutabilityDecision => {
  if (isQuotationStatusTerminal(currentStatus)) {
    return {
      ok: false,
      code: 'QUOTATION_ALREADY_TERMINAL',
      message: `a quotation in ${currentStatus} cannot be changed`,
    };
  }

  const patchKeys = Object.keys(patch).filter(
    (key) => patch[key] !== undefined,
  );
  const contentKeys = patchKeys.filter(
    (key) =>
      key !== 'version' &&
      !QUOTATION_LIFECYCLE_FIELD_NAMES.has(key) &&
      !QUOTATION_SYSTEM_FIELD_NAMES.has(key),
  );

  if (contentKeys.length > 0 && !canEditQuotationContent(currentStatus)) {
    return {
      ok: false,
      code: 'QUOTATION_IMMUTABLE',
      message:
        'quotation content is immutable after send readiness; create a new revision instead',
    };
  }

  if (contentKeys.length > 0 && !heldPermissions.includes('quotation.edit')) {
    return {
      ok: false,
      code: 'PERMISSION_MISSING',
      message: 'quotation.edit is required to change quotation content',
    };
  }

  // Optimistic concurrency: content or status writers must prove they saw the
  // current version, otherwise a parallel freeze/send can be overwritten.
  const touchesProtectedState =
    contentKeys.length > 0 ||
    (typeof patch.status === 'string' && patch.status !== currentStatus);

  if (touchesProtectedState && currentVersion !== null) {
    if (typeof patch.version !== 'number') {
      return {
        ok: false,
        code: 'QUOTATION_VERSION_REQUIRED',
        message:
          'version is required when changing a quotation; reload and retry',
      };
    }

    if (patch.version !== currentVersion) {
      return {
        ok: false,
        code: 'QUOTATION_VERSION_CONFLICT',
        message:
          'quotation was changed concurrently; reload the current version and retry',
      };
    }
  }

  const nextStatus = patch.status;

  if (typeof nextStatus === 'string' && nextStatus !== currentStatus) {
    const transition = findQuotationTransition(currentStatus, nextStatus);

    if (transition === undefined) {
      return {
        ok: false,
        code: 'TRANSITION_NOT_ALLOWED',
        message: `${currentStatus} -> ${nextStatus} is not a legal transition`,
      };
    }

    if (!heldPermissions.includes(transition.requiredPermission)) {
      return {
        ok: false,
        code: 'PERMISSION_MISSING',
        message: `${currentStatus} -> ${nextStatus} requires ${transition.requiredPermission}`,
      };
    }
  }

  return { ok: true };
};

export const evaluateQuotationLineMutation = ({
  parentStatus,
  heldPermissions,
}: {
  parentStatus: string;
  heldPermissions: readonly QuotationPermission[];
}): QuotationImmutabilityDecision => {
  if (!canEditQuotationContent(parentStatus)) {
    return {
      ok: false,
      code: 'QUOTATION_LINES_FROZEN',
      message: `a quotation in ${parentStatus} cannot have its lines changed; issue a new revision instead`,
    };
  }

  if (!heldPermissions.includes('quotation.edit')) {
    return {
      ok: false,
      code: 'PERMISSION_MISSING',
      message: 'quotation.edit is required to change quotation lines',
    };
  }

  return { ok: true };
};

export const evaluateQuotationLineReassignment = ({
  currentQuotationId,
  nextQuotationId,
}: {
  currentQuotationId: string;
  nextQuotationId: unknown;
}): QuotationImmutabilityDecision => {
  if (nextQuotationId === undefined) {
    return { ok: true };
  }

  if (
    typeof nextQuotationId === 'string' &&
    nextQuotationId === currentQuotationId
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    code: 'QUOTATION_LINE_REASSIGN_FORBIDDEN',
    message:
      'moving a line between quotations is not allowed; delete and recreate the line',
  };
};

export const evaluateQuotationDelete = ({
  currentStatus,
  heldPermissions,
}: {
  currentStatus: string;
  heldPermissions: readonly QuotationPermission[];
}): QuotationImmutabilityDecision => {
  if (!canEditQuotationContent(currentStatus)) {
    return {
      ok: false,
      code: 'QUOTATION_IMMUTABLE',
      message: `a quotation in ${currentStatus} cannot be deleted`,
    };
  }

  if (!heldPermissions.includes('quotation.edit')) {
    return {
      ok: false,
      code: 'PERMISSION_MISSING',
      message: 'quotation.edit is required to delete a quotation',
    };
  }

  return { ok: true };
};

export const resolveQuotationPermissionsFromRoleCapabilities = ({
  canUpdateAllObjectRecords,
  canUpdateAllSettings,
  canUpdateQuotationObject,
}: {
  canUpdateAllObjectRecords: boolean;
  canUpdateAllSettings: boolean;
  canUpdateQuotationObject: boolean;
}): QuotationPermission[] => {
  // Full workspace editors may approve/send/cancel/record decisions. Object-only
  // editors may draft and submit for approval, never privileged lifecycle steps.
  if (canUpdateAllObjectRecords || canUpdateAllSettings) {
    return [...QUOTATION_PERMISSIONS];
  }

  if (canUpdateQuotationObject) {
    return ['quotation.edit', 'quotation.submitForApproval'];
  }

  return [];
};
