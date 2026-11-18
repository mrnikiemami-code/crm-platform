// Server-side mirror of the quotation app domain freeze rules.
//
// WHY DUPLICATED HERE: GraphQL updateQuotation / createQuotationLine bypass the
// app HTTP routes. Immutability must be enforced in workspace query hooks, and
// twenty-server must not import twenty-apps. Keep this table aligned with
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

// Fields that may still change after content freeze (lifecycle only).
export const QUOTATION_LIFECYCLE_FIELD_NAMES = new Set([
  'status',
  'sentAt',
  'decidedAt',
  'expiresAt',
]);

const LEGAL_TRANSITIONS: ReadonlyArray<{ from: string; to: string }> = [
  { from: 'DRAFT', to: 'PENDING_INTERNAL_APPROVAL' },
  { from: 'PENDING_INTERNAL_APPROVAL', to: 'DRAFT' },
  { from: 'PENDING_INTERNAL_APPROVAL', to: 'READY_TO_SEND' },
  { from: 'READY_TO_SEND', to: 'SENT' },
  { from: 'SENT', to: 'CUSTOMER_ACCEPTED' },
  { from: 'SENT', to: 'CUSTOMER_REJECTED' },
  { from: 'SENT', to: 'EXPIRED' },
  { from: 'CUSTOMER_ACCEPTED', to: 'CONVERTED' },
  { from: 'DRAFT', to: 'CANCELLED' },
  { from: 'PENDING_INTERNAL_APPROVAL', to: 'CANCELLED' },
  { from: 'READY_TO_SEND', to: 'CANCELLED' },
  { from: 'SENT', to: 'CANCELLED' },
];

export type QuotationImmutabilityDecision =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const canEditQuotationContent = (status: string): boolean =>
  (QUOTATION_CONTENT_MUTABLE_STATUSES as readonly string[]).includes(status);

export const isQuotationStatusTerminal = (status: string): boolean =>
  (QUOTATION_TERMINAL_STATUSES as readonly string[]).includes(status);

export const isLegalQuotationTransition = (
  from: string,
  to: string,
): boolean =>
  LEGAL_TRANSITIONS.some(
    (transition) => transition.from === from && transition.to === to,
  );

export const evaluateQuotationUpdate = ({
  currentStatus,
  patch,
}: {
  currentStatus: string;
  patch: Record<string, unknown>;
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
    (key) => !QUOTATION_LIFECYCLE_FIELD_NAMES.has(key),
  );

  if (contentKeys.length > 0 && !canEditQuotationContent(currentStatus)) {
    return {
      ok: false,
      code: 'QUOTATION_IMMUTABLE',
      message:
        'quotation content is immutable after send readiness; create a new revision instead',
    };
  }

  const nextStatus = patch.status;

  if (typeof nextStatus === 'string' && nextStatus !== currentStatus) {
    if (!isLegalQuotationTransition(currentStatus, nextStatus)) {
      return {
        ok: false,
        code: 'TRANSITION_NOT_ALLOWED',
        message: `${currentStatus} -> ${nextStatus} is not a legal transition`,
      };
    }
  }

  return { ok: true };
};

export const evaluateQuotationLineMutation = ({
  parentStatus,
}: {
  parentStatus: string;
}): QuotationImmutabilityDecision => {
  if (canEditQuotationContent(parentStatus)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: 'QUOTATION_LINES_FROZEN',
    message: `a quotation in ${parentStatus} cannot have its lines changed; issue a new revision instead`,
  };
};

export const evaluateQuotationDelete = ({
  currentStatus,
}: {
  currentStatus: string;
}): QuotationImmutabilityDecision => {
  if (canEditQuotationContent(currentStatus)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: 'QUOTATION_IMMUTABLE',
    message: `a quotation in ${currentStatus} cannot be deleted`,
  };
};
