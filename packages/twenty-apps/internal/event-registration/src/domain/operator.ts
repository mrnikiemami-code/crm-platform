// The operator, as the platform reports it for the CURRENT request.
//
// `null` anywhere in here means the request could not be tied to a signed-in
// person, which is exactly the state the registration write must refuse.
export type OperatorSnapshot = {
  workspaceMemberId: string | null;
  /**
   * The platform's own id for "this user in this workspace". It is compared with
   * the id the function runtime derived from the validated token, so a stale or
   * substituted identity cannot slip through.
   */
  userWorkspaceId: string | null;
  /** "First Last" exactly as the workspace member record holds it. */
  displayName: string | null;
};

export type OperatorProblem = 'OPERATOR_CONTEXT_MISSING' | 'OPERATOR_MISMATCH';

export type ResolvedOperator =
  | { kind: 'RESOLVED'; workspaceMemberId: string; displayName: string | null }
  | { kind: 'UNRESOLVED'; reason: OperatorProblem };

const present = (value: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Decides whether a write may proceed on behalf of this operator.
 *
 * TWO independent refusals, both fail-closed:
 *   1. the request has no trusted operator id at all (the app is running as
 *      itself, not as a person) — nothing is written;
 *   2. the id the platform reports for the session differs from the id the
 *      runtime was given — nothing is written.
 *
 * There is no "assume the app role is enough" branch: that is precisely the
 * fallback this guards against.
 */
export const resolveOperator = (
  operator: OperatorSnapshot | null,
  expectedUserWorkspaceId: string | null,
): ResolvedOperator => {
  if (!present(expectedUserWorkspaceId)) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  if (operator === null) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  if (!present(operator.workspaceMemberId)) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  if (operator.userWorkspaceId !== expectedUserWorkspaceId) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_MISMATCH' };
  }

  return {
    kind: 'RESOLVED',
    workspaceMemberId: operator.workspaceMemberId,
    displayName: operator.displayName,
  };
};
