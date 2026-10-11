import { MetadataApiClient } from 'twenty-client-sdk/metadata';

// The permission flag that gates the workspace Communication settings page in
// the host UI (`SettingsRoutes.tsx` → `SettingsProtectedRouteWrapper`
// `settingsPermission={PermissionFlagType.WORKSPACE}`). The settings test-send
// route enforces the SAME flag server-side, so a UI-only check cannot be
// bypassed by calling the route directly.
export const SETTINGS_PERMISSION_FLAG = 'WORKSPACE' as const;

export type SettingsPermissionCheck =
  | { allowed: true }
  | { allowed: false; reason: 'NO_USER_CONTEXT' | 'NOT_PERMITTED' | 'CHECK_FAILED' };

type PermissionQueryClient = {
  query: (request: unknown) => Promise<unknown>;
};

/**
 * Reads the current user's workspace permission flags from the metadata API.
 *
 * This is a REAL server-side check: the route runs with a delegated user
 * access token (the executor injects `TWENTY_APP_ACCESS_TOKEN` for the
 * triggering user), so `currentUser.currentUserWorkspace` resolves to the
 * caller. An application token without a user context (a cron/event trigger)
 * has no `currentUserWorkspace`, and is refused.
 *
 * A failure to read the permissions is a REFUSAL, never an allow: an unknown
 * permission state must not authorize a real, chargeable send.
 */
export const checkSettingsPermission = async ({
  client,
}: {
  client?: PermissionQueryClient;
} = {}): Promise<SettingsPermissionCheck> => {
  const metadataClient = client ?? new MetadataApiClient();

  let result: unknown;

  try {
    result = await metadataClient.query({
      currentUser: {
        id: true,
        currentUserWorkspace: { permissionFlags: true },
      },
    });
  } catch {
    return { allowed: false, reason: 'CHECK_FAILED' };
  }

  const currentUser = (result as { currentUser?: unknown } | null)?.currentUser;

  if (typeof currentUser !== 'object' || currentUser === null) {
    return { allowed: false, reason: 'NO_USER_CONTEXT' };
  }

  const workspace = (currentUser as { currentUserWorkspace?: unknown })
    .currentUserWorkspace;

  if (typeof workspace !== 'object' || workspace === null) {
    return { allowed: false, reason: 'NO_USER_CONTEXT' };
  }

  const flags = (workspace as { permissionFlags?: unknown }).permissionFlags;

  if (!Array.isArray(flags)) {
    return { allowed: false, reason: 'NO_USER_CONTEXT' };
  }

  return flags.includes(SETTINGS_PERMISSION_FLAG)
    ? { allowed: true }
    : { allowed: false, reason: 'NOT_PERMITTED' };
};
