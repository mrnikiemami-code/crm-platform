import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { type ObjectsPermissions } from 'twenty-shared/types';

import { isExemptFromObjectPermissions } from 'src/engine/twenty-orm/utils/is-exempt-from-object-permissions.util';

const OBJECT_ID = 'object-id';

const buildObject = ({
  isSystem,
  universalIdentifier = 'some-universal-identifier',
}: {
  isSystem: boolean;
  universalIdentifier?: string;
}) =>
  ({
    id: OBJECT_ID,
    isSystem,
    universalIdentifier,
  }) as never;

const buildPermissions = (
  permissions?: Partial<ObjectsPermissions[string]>,
): ObjectsPermissions =>
  ({
    [OBJECT_ID]: {
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
      restrictedFields: {},
      rowLevelPermissionPredicates: [],
      rowLevelPermissionPredicateGroups: [],
      ...permissions,
    },
  }) as unknown as ObjectsPermissions;

describe('isExemptFromObjectPermissions', () => {
  it('never exempts a non-system object', () => {
    expect(
      isExemptFromObjectPermissions(
        buildObject({ isSystem: false }),
        buildPermissions(),
        'select',
      ),
    ).toBe(false);
  });

  it('never exempts workspaceMember, which is read by every member', () => {
    expect(
      isExemptFromObjectPermissions(
        buildObject({
          isSystem: true,
          universalIdentifier:
            STANDARD_OBJECTS.workspaceMember.universalIdentifier,
        }),
        buildPermissions({ canReadObjectRecords: false }),
        'select',
      ),
    ).toBe(false);
  });

  it('keeps the historical bypass for a system object without an override', () => {
    // The permissions map of a role that never configured the object is the
    // default; the bypass must survive, or every internal service breaks.
    expect(
      isExemptFromObjectPermissions(
        buildObject({ isSystem: true }),
        buildPermissions(),
        'select',
      ),
    ).toBe(true);

    expect(
      isExemptFromObjectPermissions(buildObject({ isSystem: true }), undefined, 'select'),
    ).toBe(true);
  });

  it('enforces an explicit deny on a system object, per operation', () => {
    const readDenied = buildPermissions({ canReadObjectRecords: false });

    expect(
      isExemptFromObjectPermissions(buildObject({ isSystem: true }), readDenied, 'select'),
    ).toBe(false);

    // A read-only deny must not block an update that the role still allows.
    expect(
      isExemptFromObjectPermissions(buildObject({ isSystem: true }), readDenied, 'update'),
    ).toBe(true);

    const destroyDenied = buildPermissions({ canDestroyObjectRecords: false });

    expect(
      isExemptFromObjectPermissions(
        buildObject({ isSystem: true }),
        destroyDenied,
        'delete',
      ),
    ).toBe(false);

    expect(
      isExemptFromObjectPermissions(
        buildObject({ isSystem: true }),
        destroyDenied,
        'select',
      ),
    ).toBe(true);
  });

  it('keeps the bypass for workflow objects so their gate stays where it is', () => {
    // Workflow access is decided by the WORKFLOWS settings permission inside the
    // cache; enforcing it here would change behaviour for roles that never opted
    // into workflow access.
    expect(
      isExemptFromObjectPermissions(
        buildObject({
          isSystem: true,
          universalIdentifier: STANDARD_OBJECTS.workflow.universalIdentifier,
        }),
        buildPermissions({ canReadObjectRecords: false }),
        'select',
      ),
    ).toBe(true);
  });
});
