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
// `workflowAutomatedTrigger` is the remaining workflow object that keeps a
// blanket bypass. The trigger engine reads it while evaluating automated
// triggers, and that path does not pass `shouldBypassPermissionChecks`, so
// enforcing the object permission here would stop triggers for every role that
// lacks WORKFLOWS. That is a real, separate decision; it is out of scope for the
// leak that was proven, and it is recorded rather than silently widened.
//
// `workflow` needs no entry: it is not a system object, so it already goes
// through the permission check.
const WORKFLOW_OBJECTS_KEEPING_THE_BYPASS: string[] = [
  STANDARD_OBJECTS.workflowAutomatedTrigger.universalIdentifier,
];

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

  if (
    WORKFLOW_OBJECTS_KEEPING_THE_BYPASS.includes(
      objectMetadata.universalIdentifier,
    )
  ) {
    return true;
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
