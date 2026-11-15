import { MetadataApiClient } from 'twenty-client-sdk/metadata';

// The flag that gates the workspace Communication settings page in the host UI
// (`SettingsRoutes.tsx` → `SettingsProtectedRouteWrapper`
// `settingsPermission={PermissionFlagType.WORKSPACE}`). The settings test-send
// route enforces the SAME flag server-side, so a UI-only check cannot be
// bypassed by calling the route directly.
export const SETTINGS_PERMISSION_FLAG = 'WORKSPACE' as const;

/**
 * The flag that authorizes sending a message out of the workspace.
 *
 * `SEND_EMAIL_TOOL` is not a name invented here: the platform's own SendEmail
 * resolver is guarded by exactly this flag
 * (`messaging/message-outbound-manager/resolvers/send-email.resolver.ts`, via
 * `SettingsPermissionGuard(PermissionFlagType.SEND_EMAIL_TOOL)`). It is also a
 * TOOL flag, which means it follows `canAccessAllTools` rather than the
 * settings switch — so an administrator is allowed by default and a role that
 * grants no tools is not, without anyone having to configure a second thing.
 *
 * It is reused for every outbound channel of this app, SMS included: the
 * platform has no channel-specific send flag, and inventing one would change
 * the core permission model (enum, settings UI, cache) rather than use what
 * exists. See the report for the follow-up if a per-channel flag is wanted.
 */
export const SEND_MESSAGE_PERMISSION_FLAG = 'SEND_EMAIL_TOOL' as const;

export type PermissionCheck =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'NO_USER_CONTEXT' | 'NOT_PERMITTED' | 'CHECK_FAILED';
    };

/** Kept for the existing settings callers. */
export type SettingsPermissionCheck = PermissionCheck;

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
export const checkPermissionFlag = async ({
  flag,
  client,
}: {
  flag: string;
  client?: PermissionQueryClient;
}): Promise<PermissionCheck> => {
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

  return flags.includes(flag)
    ? { allowed: true }
    : { allowed: false, reason: 'NOT_PERMITTED' };
};

export const checkSettingsPermission = async ({
  client,
}: {
  client?: PermissionQueryClient;
} = {}): Promise<SettingsPermissionCheck> =>
  checkPermissionFlag({ flag: SETTINGS_PERMISSION_FLAG, client });

/**
 * Authorization for sending a message to a person. Independent of whether the
 * caller can READ that person: record access says which customers a member can
 * work with, and this says whether they may message anyone at all.
 */
export const checkSendMessagePermission = async ({
  client,
}: {
  client?: PermissionQueryClient;
} = {}): Promise<PermissionCheck> =>
  checkPermissionFlag({ flag: SEND_MESSAGE_PERMISSION_FLAG, client });
