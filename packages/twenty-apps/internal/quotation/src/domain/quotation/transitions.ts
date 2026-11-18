import {
  isQuotationStatusTerminal,
  type QuotationStatus,
} from 'src/domain/quotation/status';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Who has to agree before a status change is allowed. The permission is named, not
// enforced, here: enforcement belongs to the role/RLS layer, but naming it in the
// table is what stops an approval step being forgotten on a new edge.
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

export type QuotationTransition = {
  from: QuotationStatus;
  to: QuotationStatus;
  requiredPermission: QuotationPermission;
};

// The complete set of legal edges. Anything absent is refused, including a
// self-transition: "SENT -> SENT" as a no-op would let a caller re-send a document
// and produce a second email and a second audit entry for one intent.
export const QUOTATION_TRANSITIONS: readonly QuotationTransition[] = [
  {
    from: 'DRAFT',
    to: 'PENDING_INTERNAL_APPROVAL',
    requiredPermission: 'quotation.submitForApproval',
  },
  // Back to draft is a real, needed edge: a manager rejects a draft and the owner
  // keeps working on it. Without it, rejection would strand the record.
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
  // Cancelling is allowed while the document has not become a customer decision.
  ...(['DRAFT', 'PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND', 'SENT'] as const).map(
    (from): QuotationTransition => ({
      from,
      to: 'CANCELLED',
      requiredPermission: 'quotation.cancel',
    }),
  ),
];

export const findTransition = (
  from: QuotationStatus,
  to: QuotationStatus,
): QuotationTransition | undefined =>
  QUOTATION_TRANSITIONS.find(
    (transition) => transition.from === from && transition.to === to,
  );

export type TransitionRefusal = {
  code:
    | 'TRANSITION_NOT_ALLOWED'
    | 'PERMISSION_MISSING'
    | 'QUOTATION_ALREADY_TERMINAL';
  detail: string;
};

export const checkTransition = ({
  from,
  to,
  heldPermissions,
}: {
  from: QuotationStatus;
  to: QuotationStatus;
  heldPermissions: readonly QuotationPermission[];
}): Result<QuotationTransition> => {
  // Checked first so a caller gets the more informative reason: from a terminal
  // status nothing is legal, and "not allowed" alone would not say why.
  if (isQuotationStatusTerminal(from)) {
    return refused(
      'QUOTATION_ALREADY_TERMINAL',
      `a quotation in ${from} cannot change status`,
    );
  }

  const transition = findTransition(from, to);

  if (transition === undefined) {
    return refused(
      'TRANSITION_NOT_ALLOWED',
      `${from} -> ${to} is not a legal transition`,
    );
  }

  if (!heldPermissions.includes(transition.requiredPermission)) {
    return refused(
      'PERMISSION_MISSING',
      `${from} -> ${to} requires ${transition.requiredPermission}`,
    );
  }

  return accepted(transition);
};

// Used by the S1 report and by a future settings screen: every status that cannot be
// reached from anywhere would be a dead branch of the model.
export const findUnreachableStatuses = (): QuotationStatus[] => {
  const reachable = new Set<QuotationStatus>(['DRAFT']);

  for (const transition of QUOTATION_TRANSITIONS) {
    reachable.add(transition.to);
  }

  const allStatuses: QuotationStatus[] = [
    'DRAFT',
    'PENDING_INTERNAL_APPROVAL',
    'READY_TO_SEND',
    'SENT',
    'CUSTOMER_ACCEPTED',
    'CUSTOMER_REJECTED',
    'EXPIRED',
    'CANCELLED',
    'CONVERTED',
  ];

  return allStatuses.filter((status) => !reachable.has(status));
};
