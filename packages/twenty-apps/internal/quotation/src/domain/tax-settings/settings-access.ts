// Who may change tax settings. The rate on a document is a financial decision, so
// the settings route refuses a save from a signed-in person who does not hold a
// settings-level permission flag. The flags are the platform's own; this module
// only names the subset that means "can administer this workspace".

export const TAX_SETTINGS_PERMISSION_FLAGS = [
  'WORKSPACE',
  'DATA_MODEL',
  'ROLES',
  'APPLICATIONS',
  'SECURITY',
] as const;

export type CallerPermissionFlags = readonly string[];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readFlagList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((flag): flag is string => typeof flag === 'string');
};

// Returns `null` when the response carries no person at all (an application or API
// key request). That is not a refusal by itself: the app runtime is a trusted path.
// An empty array means "a person with no settings flags", which is refused.
export const readCallerPermissionFlags = (
  data: Record<string, unknown>,
): string[] | null => {
  const currentUser = asRecord(data.currentUser);

  if (currentUser === null) {
    return null;
  }

  const workspace = asRecord(currentUser.currentUserWorkspace);

  if (workspace === null) {
    return null;
  }

  return readFlagList(workspace.permissionFlags) ?? [];
};

export const holdsTaxSettingsPermission = (
  flags: CallerPermissionFlags,
): boolean =>
  flags.some((flag) =>
    (TAX_SETTINGS_PERMISSION_FLAGS as readonly string[]).includes(flag),
  );

// `null` flags = trusted application caller, allowed. An array must hold an admin
// flag. Keeping the decision here means the route only wires the query.
export const mayChangeTaxSettings = (
  flags: CallerPermissionFlags | null,
): boolean => flags === null || holdsTaxSettingsPermission(flags);
