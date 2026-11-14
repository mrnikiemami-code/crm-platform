import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { type ObjectsPermissions } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

// Historically every system object bypassed object-level permissions. That is
// still the default, because the role permissions cache fills a system object
// with `true` when a role has no override for it, and internal services rely on
// the bypass when the permissions map is empty.
//
// The one case that must NOT bypass is an explicit deny: when the computed
// permission for this operation is `false`, someone decided this role must not
// reach the object, and the bypass used to swallow that decision. Only an
// explicit `false` is enforced, so an object with a missing entry or `true`
// behaves exactly as before.
//
// After this, NO system object keeps a blanket bypass: every one of them goes
// through the computed permission, and only an explicit `false` changes the
// outcome. That is safe for internal execution because the internal paths do not
// rely on this exemption at all — they either build a system auth context, which
// `resolveRolePermissionConfig` turns into `shouldBypassPermissionChecks: true`
// and the repository returns on before reaching this function, or they already
// hold the WORKFLOWS setting permission, whose value the cache has already
// written into the permission entry.
//
// `workflow` needs no special case: it is not a system object, so it always went
// through the check.
type OperationPermissionKey = keyof Pick<
  ObjectsPermissions[string],
  | 'canReadObjectRecords'
  | 'canUpdateObjectRecords'
  | 'canSoftDeleteObjectRecords'
  | 'canDestroyObjectRecords'
>;

const PERMISSION_KEY_BY_OPERATION: Record<string, OperationPermissionKey> = {
  select: 'canReadObjectRecords',
  insert: 'canUpdateObjectRecords',
  update: 'canUpdateObjectRecords',
  delete: 'canDestroyObjectRecords',
  restore: 'canSoftDeleteObjectRecords',
  'soft-delete': 'canSoftDeleteObjectRecords',
};

export const isExemptFromObjectPermissions = (
  objectMetadata: FlatObjectMetadata,
  objectsPermissions?: ObjectsPermissions,
  operationType: string = 'select',
): boolean => {
  if (objectMetadata.isSystem !== true) {
    return false;
  }

  if (
    objectMetadata.universalIdentifier ===
    STANDARD_OBJECTS.workspaceMember.universalIdentifier
  ) {
    return false;
  }

  const permissionsForObject = objectsPermissions?.[objectMetadata.id];

  if (!isDefined(permissionsForObject)) {
    return true;
  }

  const permissionKey =
    PERMISSION_KEY_BY_OPERATION[operationType] ?? 'canReadObjectRecords';

  // Only an explicit deny leaves the exemption.
  return permissionsForObject[permissionKey] !== false;
};
