import { describe, expect, it } from 'vitest';

import {
  SETTINGS_PERMISSION_FLAG,
  checkSettingsPermission,
} from 'src/settings/settings-permission';

const buildClient = (result: unknown) => ({
  query: async () => result,
});

const buildThrowingClient = () => ({
  query: async () => {
    throw new Error('unauthenticated');
  },
});

describe('checkSettingsPermission', () => {
  it('allows when the current user holds the settings flag', async () => {
    const result = await checkSettingsPermission({
      client: buildClient({
        currentUser: {
          id: 'u1',
          currentUserWorkspace: { permissionFlags: [SETTINGS_PERMISSION_FLAG] },
        },
      }),
    });

    expect(result).toEqual({ allowed: true });
  });

  it('refuses when the flag is absent', async () => {
    const result = await checkSettingsPermission({
      client: buildClient({
        currentUser: {
          id: 'u1',
          currentUserWorkspace: { permissionFlags: ['VIEWS'] },
        },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NOT_PERMITTED' });
  });

  it('refuses when there is no user context (application token)', async () => {
    const result = await checkSettingsPermission({
      client: buildClient({
        currentUser: { id: 'u1', currentUserWorkspace: null },
      }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NO_USER_CONTEXT' });
  });

  it('refuses when the permission query fails — never allows on error', async () => {
    const result = await checkSettingsPermission({
      client: buildThrowingClient(),
    });

    expect(result.allowed).toBe(false);
    expect(result).toEqual({ allowed: false, reason: 'CHECK_FAILED' });
  });

  it('refuses when there is no current user at all', async () => {
    const result = await checkSettingsPermission({
      client: buildClient({ currentUser: null }),
    });

    expect(result).toEqual({ allowed: false, reason: 'NO_USER_CONTEXT' });
  });
});
