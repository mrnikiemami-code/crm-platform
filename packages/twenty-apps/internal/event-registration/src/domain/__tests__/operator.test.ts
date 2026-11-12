import { describe, expect, it } from 'vitest';

import { resolveOperator } from 'src/domain/operator';

describe('resolveOperator', () => {
  const OPERATOR = {
    workspaceMemberId: 'member-1',
    userWorkspaceId: 'uw-1',
    displayName: 'امیر نصرتی',
  };

  it('resolves when the session matches the runtime operator id', () => {
    expect(resolveOperator(OPERATOR, 'uw-1')).toEqual({
      kind: 'RESOLVED',
      workspaceMemberId: 'member-1',
      displayName: 'امیر نصرتی',
    });
  });

  it('resolves from the verified session when the runtime supplies no id', () => {
    // A plain route trigger carries no operator id; the platform's
    // `currentUser` answer is the identity, so this is a normal sign-in.
    expect(resolveOperator(OPERATOR, null)).toEqual({
      kind: 'RESOLVED',
      workspaceMemberId: 'member-1',
      displayName: 'امیر نصرتی',
    });
  });

  it('refuses when the platform returned no user', () => {
    expect(resolveOperator(null, 'uw-1')).toEqual({
      kind: 'UNRESOLVED',
      reason: 'OPERATOR_CONTEXT_MISSING',
    });
  });

  it('refuses when the user is not a workspace member', () => {
    expect(
      resolveOperator({ ...OPERATOR, workspaceMemberId: null }, 'uw-1'),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'OPERATOR_CONTEXT_MISSING' });
  });

  it('refuses when the two identities disagree', () => {
    expect(
      resolveOperator({ ...OPERATOR, userWorkspaceId: 'uw-OTHER' }, 'uw-1'),
    ).toEqual({ kind: 'UNRESOLVED', reason: 'OPERATOR_MISMATCH' });
  });

  it('refuses when the platform reports an empty operator id', () => {
    expect(
      resolveOperator({ ...OPERATOR, userWorkspaceId: '' }, 'uw-1'),
    ).toEqual({
      kind: 'UNRESOLVED',
      reason: 'OPERATOR_CONTEXT_MISSING',
    });
  });
});
