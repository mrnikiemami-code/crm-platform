// Allow-list of Quotation UI actions a front component may run as the signed-in user.
// Same narrow-bridge idea as Communication: the host pins the route; the worker
// only names an action.

export const ALLOWED_QUOTATION_ACTIONS = [
  'get-lifecycle',
  'transition',
  'generate-pdf',
  'create-customer-link',
  'revoke-customer-link',
] as const;

export type AllowedQuotationAction = (typeof ALLOWED_QUOTATION_ACTIONS)[number];

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set(ALLOWED_QUOTATION_ACTIONS);

export const isAllowedQuotationAction = (
  action: unknown,
): action is AllowedQuotationAction =>
  typeof action === 'string' && ALLOWED_ACTIONS.has(action);
