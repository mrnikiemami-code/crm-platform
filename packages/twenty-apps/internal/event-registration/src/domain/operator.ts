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
 * The identity always comes from the platform's answer for the CURRENT request
 * (`currentUser`, guarded by the user-auth guard) — never from the request body
 * and never from an assumption that the app role is enough.
 *
 * TWO refusals, both fail-closed:
 *   1. the platform reports no signed-in member for this session (the function
 *      is running as the application, not as a person) — nothing is written;
 *   2. the runtime states which session it authenticated and the platform
 *      reports a different one — the two disagree, so nothing is written.
 *
 * `expectedUserWorkspaceId` is optional because a plain route trigger does not
 * carry it; when it is absent the verified `currentUser` answer remains the
 * only source of identity, which is why the check above still applies.
 */
export const resolveOperator = (
  operator: OperatorSnapshot | null,
  expectedUserWorkspaceId: string | null,
): ResolvedOperator => {
  if (operator === null) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  if (
    !present(operator.workspaceMemberId) ||
    !present(operator.userWorkspaceId)
  ) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' };
  }

  if (
    present(expectedUserWorkspaceId) &&
    operator.userWorkspaceId !== expectedUserWorkspaceId
  ) {
    return { kind: 'UNRESOLVED', reason: 'OPERATOR_MISMATCH' };
  }

  return {
    kind: 'RESOLVED',
    workspaceMemberId: operator.workspaceMemberId,
    displayName: operator.displayName,
  };
};
