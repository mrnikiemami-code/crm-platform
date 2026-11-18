// The lifecycle of a quotation, as data. Transitions are a table rather than a
// chain of ifs so that "is this allowed?" is one lookup a test can enumerate
// exhaustively, and so a reviewer can see the whole shape at once.
//
// WHY THE LIST HAS NO `WON`: the Opportunity pipeline in this workspace ends at
// CUSTOMER and has no WON/LOST stage, so conversion cannot be inferred from the
// opportunity. The quotation carries its own terminal state, and CONVERTED means
// "an accounting document now exists for it" — a fact only this app knows.
export const QUOTATION_STATUSES = [
  'DRAFT',
  'PENDING_INTERNAL_APPROVAL',
  'READY_TO_SEND',
  'SENT',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_REJECTED',
  'EXPIRED',
  'CANCELLED',
  'CONVERTED',
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

// Statuses a record can never leave. EXPIRED and CANCELLED are dead ends by
// definition; CONVERTED is terminal because the accounting document owns the truth
// from then on, and "un-converting" would need a credit note, not a status change.
export const TERMINAL_QUOTATION_STATUSES: readonly QuotationStatus[] = [
  'CUSTOMER_REJECTED',
  'EXPIRED',
  'CANCELLED',
  'CONVERTED',
];

// The content of a quotation is frozen from the moment a customer can see it.
// Before that, a draft is meant to be edited; after that, changing a line without a
// new revision means the PDF a customer holds no longer matches the record.
export const statusesAllowingLineEdits: readonly QuotationStatus[] = [
  'DRAFT',
  'PENDING_INTERNAL_APPROVAL',
];

export const isQuotationStatusTerminal = (status: QuotationStatus): boolean =>
  TERMINAL_QUOTATION_STATUSES.includes(status);

export const canEditQuotationLines = (status: QuotationStatus): boolean =>
  statusesAllowingLineEdits.includes(status);
