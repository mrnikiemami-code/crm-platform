// The allow-list of Communication actions a front component may run as the
// signed-in user.
//
// Why an allow-list at all: the host bridge is the only path from a component to
// a USER-scoped server operation, so it must not become a general-purpose proxy.
// The component supplies an action name and arguments; the host pins the route
// and refuses anything not named here, so a component cannot reach an arbitrary
// endpoint, name another user, or choose a workspace.
//
// The server remains the authority — this list only narrows what a component can
// ask for in the first place.
export const ALLOWED_COMMUNICATION_ACTIONS = [
  'read-template',
  'save-template',
  'catalog',
  'eligible-sources',
  'source-records',
  'search-people',
  'preview',
] as const;

export type AllowedCommunicationAction =
  (typeof ALLOWED_COMMUNICATION_ACTIONS)[number];

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set(
  ALLOWED_COMMUNICATION_ACTIONS,
);

/**
 * True only for an exact, allow-listed action name.
 *
 * The comparison is exact on purpose: no prefix matching, no case folding and no
 * trimming, so `'preview '` or `'PREVIEW'` are refused rather than normalised into
 * something the server might read differently from this check.
 */
export const isAllowedCommunicationAction = (
  action: unknown,
): action is AllowedCommunicationAction =>
  typeof action === 'string' && ALLOWED_ACTIONS.has(action);
