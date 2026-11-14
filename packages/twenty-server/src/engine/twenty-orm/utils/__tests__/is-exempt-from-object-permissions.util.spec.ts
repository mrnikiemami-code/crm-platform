import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { type ObjectsPermissions } from 'twenty-shared/types';

import { isExemptFromObjectPermissions } from 'src/engine/twenty-orm/utils/is-exempt-from-object-permissions.util';
import { isObjectOperationPermitted } from 'src/engine/twenty-orm/utils/is-object-operation-permitted.util';

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

  it('enforces an explicit deny on workflowAutomatedTrigger too', () => {
    // The last exempt workflow object. Its internal reader uses a system auth
    // context, which bypasses before this function is reached, so enforcing the
    // computed permission here cannot disturb it.
    const objectMetadata = buildObject({
      isSystem: true,
      universalIdentifier:
        STANDARD_OBJECTS.workflowAutomatedTrigger.universalIdentifier,
    });
    const denied = buildPermissions({ canReadObjectRecords: false });

    expect(isExemptFromObjectPermissions(objectMetadata, denied, 'select')).toBe(
      false,
    );
    expect(
      isObjectOperationPermitted({
        objectMetadata,
        operationType: 'select',
        objectsPermissions: denied,
      }),
    ).toBe(false);
  });

  it('leaves workflowAutomatedTrigger readable for a role holding WORKFLOWS', () => {
    // The cache derives this entry from the WORKFLOWS setting permission, so a
    // permitted role keeps its access.
    expect(
      isExemptFromObjectPermissions(
        buildObject({
          isSystem: true,
          universalIdentifier:
            STANDARD_OBJECTS.workflowAutomatedTrigger.universalIdentifier,
        }),
        buildPermissions({ canReadObjectRecords: true }),
        'select',
      ),
    ).toBe(true);
  });

  it('enforces an explicit deny on workflowVersion and workflowRun', () => {
    // Proven leak: a member without WORKFLOWS could list every version, including
    // its name, status and creation time.
    for (const universalIdentifier of [
      STANDARD_OBJECTS.workflowVersion.universalIdentifier,
      STANDARD_OBJECTS.workflowRun.universalIdentifier,
    ]) {
      const objectMetadata = buildObject({ isSystem: true, universalIdentifier });
      const denied = buildPermissions({ canReadObjectRecords: false });

      expect(isExemptFromObjectPermissions(objectMetadata, denied, 'select')).toBe(
        false,
      );
      expect(
        isObjectOperationPermitted({
          objectMetadata,
          operationType: 'select',
          objectsPermissions: denied,
        }),
      ).toBe(false);
    }
  });

  it('leaves workflowVersion readable when the role was granted it', () => {
    // A role WITH the WORKFLOWS permission gets `true` from the cache; the fix
    // must not take that away.
    const objectMetadata = buildObject({
      isSystem: true,
      universalIdentifier: STANDARD_OBJECTS.workflowVersion.universalIdentifier,
    });

    expect(
      isExemptFromObjectPermissions(
        objectMetadata,
        buildPermissions({ canReadObjectRecords: true }),
        'select',
      ),
    ).toBe(true);
  });

  it('leaves workflowVersion writable for a role that only has write', () => {
    // Read denial must not become a blanket denial: a role that may update but not
    // read still passes the update check.
    const objectMetadata = buildObject({
      isSystem: true,
      universalIdentifier: STANDARD_OBJECTS.workflowVersion.universalIdentifier,
    });
    const readDeniedWriteAllowed = buildPermissions({
      canReadObjectRecords: false,
      canUpdateObjectRecords: true,
    });

    expect(
      isExemptFromObjectPermissions(
        objectMetadata,
        readDeniedWriteAllowed,
        'update',
      ),
    ).toBe(true);
  });

  it('does not change the workflow object itself', () => {
    // `workflow` is not a system object, so it always went through the check. Its
    // outcome must be identical before and after this change.
    const objectMetadata = buildObject({
      isSystem: false,
      universalIdentifier: STANDARD_OBJECTS.workflow.universalIdentifier,
    });

    expect(
      isExemptFromObjectPermissions(
        objectMetadata,
        buildPermissions({ canReadObjectRecords: false }),
        'select',
      ),
    ).toBe(false);

    expect(
      isExemptFromObjectPermissions(
        objectMetadata,
        buildPermissions({ canReadObjectRecords: true }),
        'select',
      ),
    ).toBe(false);
  });
});
