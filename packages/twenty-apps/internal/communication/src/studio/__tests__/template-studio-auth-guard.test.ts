import { describe, expect, it } from 'vitest';

import routeResult from 'src/logic-functions/template-studio';

// BEHAVIOURAL test of the authorization boundary, not a source grep.
//
// It calls the real exported handler with the exact event shape the route trigger
// produces. The handler is invoked with NO workspace, no client and no metadata
// client, so if the guard were placed after any data access these calls would
// throw instead of returning a clean refusal — which is precisely the ordering
// this test locks.
const handler = (
  routeResult.config as unknown as {
    handler: (event: unknown) => Promise<Record<string, unknown>>;
  }
).handler;

const callWithNoUser = (action: string) =>
  handler({
    body: { action },
    // What the platform supplies when only an APPLICATION token authenticated the
    // request: no user identity at all.
    userWorkspaceId: null,
  });

describe('template route authorization boundary', () => {
  const guardedActions = [
    'list',
    'search-people',
    'eligible-sources',
    'source-records',
    'read-template',
    'save-template',
    'preview',
    'create',
    'update',
    'delete',
  ];

  it('refuses EVERY data-touching action when no user is authenticated', async () => {
    for (const action of guardedActions) {
      const result = await callWithNoUser(action);

      expect(result.success, action).toBe(false);
      expect(result.errorCode, action).toBe('AUTH_REQUIRED');
      // A stable, application-owned message the UI can render as-is.
      expect(typeof result.message, action).toBe('string');
      expect((result.message as string).length, action).toBeGreaterThan(0);
    }
  });

  it('refuses an empty user identity as well as a missing one', async () => {
    for (const userWorkspaceId of [null, '', undefined]) {
      const result = await handler({
        body: { action: 'read-template', templateId: 'any' },
        userWorkspaceId,
      });

      expect(result.errorCode).toBe('AUTH_REQUIRED');
    }
  });

  it('never consults a client-supplied identity', async () => {
    // A forged identity in the BODY is ignored: only the platform's own
    // `userWorkspaceId` is consulted, so this still refuses.
    const result = await handler({
      body: {
        action: 'read-template',
        templateId: 'any',
        userId: 'forged-user',
        userWorkspaceId: 'forged-workspace',
        role: 'ADMIN',
      },
      userWorkspaceId: null,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_REQUIRED');
  });

  it('rejects a malformed body before anything else', async () => {
    const result = await handler({ body: null, userWorkspaceId: 'user-ws' });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_INPUT');
  });
});
