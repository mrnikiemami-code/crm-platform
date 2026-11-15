import { describe, expect, it } from 'vitest';

import {
  SEND_MESSAGE_PERMISSION_FLAG,
  checkSendMessagePermission,
} from 'src/settings/settings-permission';

const buildClient = (result: unknown) => ({
  query: async () => result,
});

const buildThrowingClient = () => ({
  query: async () => {
    throw new Error('unauthenticated');
  },
});

// Sending a message is authorized independently of reading the customer. These
// cases pin the two halves apart: a member can hold every record permission and
// still be refused a send, and a member with no tools cannot reach the route.
describe('checkSendMessagePermission', () => {
  it('allows a caller who holds the send flag (an administrator)', async () => {
    const result = await checkSendMessagePermission({
      client: buildClient({
        currentUser: {
          id: 'admin',
          currentUserWorkspace: {
            permissionFlags: [SEND_MESSAGE_PERMISSION_FLAG],
          },
        },
      }),
    });

    expect(result).toEqual({ allowed: true });
  });

  it('refuses a caller whose role grants no tools (a restricted member)', async () => {
    const result = await checkSendMessagePermission({
      client: buildClient({
        currentUser: {
          id: 'restricted',
          currentUserWorkspace: { permissionFlags: ['VIEWS'] },
        },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NOT_PERMITTED' });
  });

  it('refuses a caller with no permission flags at all', async () => {
    const result = await checkSendMessagePermission({
      client: buildClient({
        currentUser: {
          id: 'restricted',
          currentUserWorkspace: { permissionFlags: [] },
        },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NOT_PERMITTED' });
  });

  it('refuses an application context with no user', async () => {
    const result = await checkSendMessagePermission({
      client: buildClient({
        currentUser: { id: 'app', currentUserWorkspace: null },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NO_USER_CONTEXT' });
  });

  it('refuses when the permission read fails — never allows on error', async () => {
    const result = await checkSendMessagePermission({
      client: buildThrowingClient(),
    });

    expect(result).toEqual({ allowed: false, reason: 'CHECK_FAILED' });
  });

  it('is a different flag from the settings gate', async () => {
    // Holding the settings flag alone must not authorize a send.
    const result = await checkSendMessagePermission({
      client: buildClient({
        currentUser: {
          id: 'settings-only',
          currentUserWorkspace: { permissionFlags: ['WORKSPACE'] },
        },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NOT_PERMITTED' });
  });
});
