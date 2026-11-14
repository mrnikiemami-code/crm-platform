import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { type ObjectsPermissions } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { isWorkflowRelatedObject } from 'src/engine/metadata-modules/ai/ai-agent/utils/is-workflow-related-object.util';
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
// Workflow objects keep the bypass on purpose: their access is already gated by
// the WORKFLOWS settings permission inside the cache, and enforcing it here would
// change behaviour for roles that never opted into workflow access. That is out
// of scope for this fix.
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

  if (isWorkflowRelatedObject(objectMetadata)) {
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
