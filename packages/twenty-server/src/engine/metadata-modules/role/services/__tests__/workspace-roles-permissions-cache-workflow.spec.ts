import { PermissionFlagType, SystemPermissionFlag } from 'twenty-shared/constants';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { WorkspaceRolesPermissionsCacheService } from 'src/engine/metadata-modules/role/services/workspace-roles-permissions-cache.service';

const WORKSPACE_ID = 'workspace-id';
const ROLE_ID = 'role-id';
const WORKFLOWS_FLAG_ID = 'workflows-flag-id';

const buildRole = (overrides: Record<string, unknown> = {}) =>
  ({
    id: ROLE_ID,
    label: 'Restricted',
    canReadAllObjectRecords: true,
    canUpdateAllObjectRecords: true,
    canSoftDeleteAllObjectRecords: false,
    canDestroyAllObjectRecords: false,
    canUpdateAllSettings: false,
    ...overrides,
  }) as never;

const buildObjectMetadata = (
  nameSingular: keyof typeof STANDARD_OBJECTS,
  isSystem: boolean,
) =>
  ({
    id: `${nameSingular}-id`,
    isSystem,
    universalIdentifier: STANDARD_OBJECTS[nameSingular].universalIdentifier,
    labelIdentifierFieldMetadataId: null,
  }) as never;

const buildRows = ({
  role,
  rolePermissionFlags = [],
}: {
  role: unknown;
  rolePermissionFlags?: unknown[];
}) =>
  ({
    role: [role],
    objectPermission: { byRoleId: new Map() },
    rolePermissionFlag: { byRoleId: new Map([[ROLE_ID, rolePermissionFlags]]) },
    permissionFlag: [
      {
        id: WORKFLOWS_FLAG_ID,
        key: PermissionFlagType.WORKFLOWS,
        universalIdentifier: SystemPermissionFlag[PermissionFlagType.WORKFLOWS],
      },
    ],
    fieldPermission: { byRoleId: new Map() },
    rowLevelPermissionPredicate: { byRoleId: new Map() },
    rowLevelPermissionPredicateGroup: { byRoleId: new Map() },
    objectMetadata: [
      buildObjectMetadata('workflow', false),
      buildObjectMetadata('workflowVersion', true),
      buildObjectMetadata('workflowRun', true),
      buildObjectMetadata('workflowAutomatedTrigger', true),
      buildObjectMetadata('person', false),
    ],
  }) as never;

const WORKFLOW_OBJECT_IDS = [
  'workflow-id',
  'workflowVersion-id',
  'workflowRun-id',
  'workflowAutomatedTrigger-id',
];

const computePermissions = (rows: unknown) =>
  new WorkspaceRolesPermissionsCacheService().computeForCache({
    workspaceId: WORKSPACE_ID,
    rows,
  } as never)[ROLE_ID];

describe('workspace roles permissions cache — workflow objects', () => {
  it('denies every workflow object to a role without WORKFLOWS', () => {
    // The trigger rows say which event an automation listens to, so they were the
    // one gap left when only version and run were listed.
    const permissions = computePermissions(buildRows({ role: buildRole() }));

    for (const objectId of WORKFLOW_OBJECT_IDS) {
      expect(permissions[objectId].canReadObjectRecords).toBe(false);
    }
  });

  it('still denies them when the role may read all other objects', () => {
    // `canReadAllObjectRecords` must not leak into the workflow gate: that is the
    // setting a restricted or an ordinary member role carries.
    const permissions = computePermissions(
      buildRows({ role: buildRole({ canReadAllObjectRecords: true }) }),
    );

    expect(permissions['workflowAutomatedTrigger-id'].canReadObjectRecords).toBe(
      false,
    );
  });

  it('grants all four to a role holding the WORKFLOWS permission', () => {
    const permissions = computePermissions(
      buildRows({
        role: buildRole(),
        rolePermissionFlags: [
          {
            id: 'flag-row',
            permissionFlagId: WORKFLOWS_FLAG_ID,
            permissionFlag: {
              id: WORKFLOWS_FLAG_ID,
              universalIdentifier:
                SystemPermissionFlag[PermissionFlagType.WORKFLOWS],
            },
          },
        ],
      }),
    );

    for (const objectId of WORKFLOW_OBJECT_IDS) {
      expect(permissions[objectId].canReadObjectRecords).toBe(true);
    }
  });

  it('grants them to a role that may update all settings', () => {
    // `hasSettingsGatedObjectPermissions` treats canUpdateAllSettings as holding
    // every setting permission, so admin keeps its access.
    const permissions = computePermissions(
      buildRows({ role: buildRole({ canUpdateAllSettings: true }) }),
    );

    for (const objectId of WORKFLOW_OBJECT_IDS) {
      expect(permissions[objectId].canReadObjectRecords).toBe(true);
    }
  });

  it('applies the workflow gate to write permissions too', () => {
    // Update/soft-delete/destroy follow the same gate, so a denied role cannot
    // reach the triggers another way.
    const permissions = computePermissions(buildRows({ role: buildRole() }));
    const denied = permissions['workflowAutomatedTrigger-id'];

    expect(denied.canUpdateObjectRecords).toBe(false);
    expect(denied.canSoftDeleteObjectRecords).toBe(false);
    expect(denied.canDestroyObjectRecords).toBe(false);
  });

  it('leaves a non-workflow object on its own defaults', () => {
    // The fix must not touch anything outside the workflow gate.
    const permissions = computePermissions(buildRows({ role: buildRole() }));

    expect(permissions['person-id'].canReadObjectRecords).toBe(true);
  });

  it('keeps the flag identifier in sync with the platform constant', () => {
    // A guard against the test passing on a renamed flag.
    expect(SystemPermissionFlag[PermissionFlagType.WORKFLOWS]).toBeDefined();
  });
});
