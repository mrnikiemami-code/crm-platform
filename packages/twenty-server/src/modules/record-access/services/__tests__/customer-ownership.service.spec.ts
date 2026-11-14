import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { CustomerOwnershipService } from 'src/modules/record-access/services/customer-ownership.service';

const PERSON_OBJECT_METADATA_ID = 'person-object-metadata-id';
const PERSON_ASSIGNEE_FIELD_METADATA_ID = 'person-assignee-field-metadata-id';
const WORKSPACE_ID = 'workspace-id';
const USER_WORKSPACE_ID = 'user-workspace-id';
const MEMBER_ID = 'member-id';
const OTHER_MEMBER_ID = 'other-member-id';
const RESTRICTED_ROLE_ID = 'restricted-role-id';
const UNRESTRICTED_ROLE_ID = 'unrestricted-role-id';

const buildAuthContext = (
  overrides: Partial<WorkspaceAuthContext> = {},
): WorkspaceAuthContext =>
  ({
    type: 'user',
    workspace: { id: WORKSPACE_ID },
    user: { id: 'user-id' },
    userWorkspaceId: USER_WORKSPACE_ID,
    workspaceMemberId: MEMBER_ID,
    workspaceMember: { id: MEMBER_ID },
    ...overrides,
  }) as unknown as WorkspaceAuthContext;

const buildCacheResult = ({ roleId }: { roleId?: string }) => ({
  userWorkspaceRoleMap:
    roleId === undefined ? {} : { [USER_WORKSPACE_ID]: roleId },
  rolesPermissions: {
    [RESTRICTED_ROLE_ID]: {
      [PERSON_OBJECT_METADATA_ID]: {
        canReadObjectRecords: true,
        canUpdateObjectRecords: true,
        canSoftDeleteObjectRecords: false,
        canDestroyObjectRecords: false,
        restrictedFields: {},
        rowLevelPermissionPredicateGroups: [],
        rowLevelPermissionPredicates: [
          { fieldMetadataId: PERSON_ASSIGNEE_FIELD_METADATA_ID },
        ],
      },
    },
    [UNRESTRICTED_ROLE_ID]: {
      [PERSON_OBJECT_METADATA_ID]: {
        canReadObjectRecords: true,
        canUpdateObjectRecords: true,
        canSoftDeleteObjectRecords: true,
        canDestroyObjectRecords: true,
        restrictedFields: {},
        rowLevelPermissionPredicateGroups: [],
        rowLevelPermissionPredicates: [],
      },
    },
  },
  flatObjectMetadataMaps: {
    byUniversalIdentifier: {
      'person-universal-identifier': {
        id: PERSON_OBJECT_METADATA_ID,
        nameSingular: 'person',
        namePlural: 'people',
      },
    },
  },
});

describe('CustomerOwnershipService', () => {
  const getOrRecompute = jest.fn();
  const findOne = jest.fn();
  const executeInWorkspaceContext = jest.fn(
    async (fn: () => Promise<unknown>) => await fn(),
  );
  const getRepository = jest.fn((_objectName?: string) => ({ findOne }));

  const service = new CustomerOwnershipService(
    { getOrRecompute } as unknown as WorkspaceCacheService,
    {
      getRepository,
      executeInWorkspaceContext,
    } as unknown as WorkspaceOrmManager,
  );

  beforeEach(() => {
    getOrRecompute.mockReset();
    findOne.mockReset();
    getRepository.mockReset();
    getRepository.mockImplementation(() => ({ findOne }));
    executeInWorkspaceContext.mockReset();
    executeInWorkspaceContext.mockImplementation(
      async (fn: () => Promise<unknown>) => await fn(),
    );
  });

  describe('resolveRowRestrictedMemberId', () => {
    it('treats a member whose role has a rule on the customer as restricted', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      expect(
        await service.resolveRowRestrictedMemberId(buildAuthContext()),
      ).toBe(MEMBER_ID);
    });

    it('lets a role without a customer rule assign ownership', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: UNRESTRICTED_ROLE_ID }),
      );

      expect(
        await service.resolveRowRestrictedMemberId(buildAuthContext()),
      ).toBeNull();
    });

    it('fails closed when the actor has no resolvable role', async () => {
      getOrRecompute.mockResolvedValue(buildCacheResult({}));

      expect(
        await service.resolveRowRestrictedMemberId(buildAuthContext()),
      ).toBe(MEMBER_ID);
    });

    it('does not confine the system context', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      expect(
        await service.resolveRowRestrictedMemberId({
          type: 'system',
          workspace: { id: WORKSPACE_ID },
        } as unknown as WorkspaceAuthContext),
      ).toBeNull();
    });

    it('does not confine an application acting on its own', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      expect(
        await service.resolveRowRestrictedMemberId({
          type: 'application',
          workspace: { id: WORKSPACE_ID },
          application: { id: 'app-id' },
        } as unknown as WorkspaceAuthContext),
      ).toBeNull();
    });
  });

  describe('assignOwnerToCreatedCustomers', () => {
    it('stamps the acting member over a client-supplied owner', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      const records: Array<Record<string, unknown>> = [
        {
          nameFirstName: 'A',
          assigneeId: 'somebody-else',
          assignee: { id: 'x' },
        },
      ];

      await service.assignOwnerToCreatedCustomers({
        authContext: buildAuthContext(),
        records,
      });

      expect(records[0].assigneeId).toBe(MEMBER_ID);
      expect(records[0].assignee).toBeUndefined();
      expect(records[0].nameFirstName).toBe('A');
    });

    it('leaves a manager payload untouched', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: UNRESTRICTED_ROLE_ID }),
      );

      const records: Array<Record<string, unknown>> = [
        { nameFirstName: 'A', assigneeId: 'chosen-by-the-manager' },
      ];

      await service.assignOwnerToCreatedCustomers({
        authContext: buildAuthContext(),
        records,
      });

      expect(records[0].assigneeId).toBe('chosen-by-the-manager');
    });

    it('stamps every row of a bulk create', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      const records: Array<Record<string, unknown>> = [
        { nameFirstName: 'A' },
        { nameFirstName: 'B', assigneeId: 'somebody-else' },
      ];

      await service.assignOwnerToCreatedCustomers({
        authContext: buildAuthContext(),
        records,
      });

      expect(records.map((record) => record.assigneeId)).toEqual([
        MEMBER_ID,
        MEMBER_ID,
      ]);
    });
  });

  describe('assignOwnerToCreatedDependents', () => {
    it('stamps the owner when the customer belongs to the acting member', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );
      findOne.mockResolvedValue({ id: 'customer-id', assigneeId: MEMBER_ID });

      const records: Array<Record<string, unknown>> = [
        { personId: 'customer-id' },
      ];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'eventRegistration',
        records,
      });

      expect(records[0].assigneeId).toBe(MEMBER_ID);
    });

    it("leaves the owner unset for a customer the member cannot read", async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );
      // Unreadable through the caller's permissions, so the row is not found.
      findOne.mockResolvedValue(null);

      const records: Array<Record<string, unknown>> = [
        { personId: 'foreign-customer-id' },
      ];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'eventRegistration',
        records,
      });

      expect(records[0].assigneeId).toBeUndefined();
    });

    it('ignores an owner the client sent', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );
      findOne.mockResolvedValue({ id: 'customer-id', assigneeId: MEMBER_ID });

      const records: Array<Record<string, unknown>> = [
        { personId: 'customer-id', assigneeId: OTHER_MEMBER_ID },
      ];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'eventRegistration',
        records,
      });

      expect(records[0].assigneeId).toBe(MEMBER_ID);
    });

    it('walks the lead of a sales interaction to its customer', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      const leadFindOne = jest.fn().mockResolvedValue({
        id: 'lead-id',
        personId: 'customer-id',
      });
      findOne.mockResolvedValue({ id: 'customer-id', assigneeId: MEMBER_ID });
      getRepository.mockImplementation((objectName: string) =>
        objectName === 'eventLead'
          ? { findOne: leadFindOne }
          : { findOne },
      );
      const records: Array<Record<string, unknown>> = [
        { eventLeadId: 'lead-id' },
      ];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'salesInteraction',
        records,
      });

      expect(records[0].assigneeId).toBe(MEMBER_ID);
    });

    it('uses the assignedTo column for a lead', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );
      findOne.mockResolvedValue({ id: 'customer-id', assigneeId: MEMBER_ID });

      const records: Array<Record<string, unknown>> = [
        { personId: 'customer-id' },
      ];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'eventLead',
        records,
      });

      expect(records[0].assignedToId).toBe(MEMBER_ID);
      expect(records[0].assigneeId).toBeUndefined();
    });

    it('does nothing for a manager', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: UNRESTRICTED_ROLE_ID }),
      );

      const records: Array<Record<string, unknown>> = [{ personId: 'p' }];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'eventRegistration',
        records,
      });

      expect(records[0].assigneeId).toBeUndefined();
      expect(findOne).not.toHaveBeenCalled();
    });

    it('ignores an object it does not own', async () => {
      getOrRecompute.mockResolvedValue(
        buildCacheResult({ roleId: RESTRICTED_ROLE_ID }),
      );

      const records: Array<Record<string, unknown>> = [{ id: 'x' }];

      await service.assignOwnerToCreatedDependents({
        authContext: buildAuthContext(),
        objectNameSingular: 'company',
        records,
      });

      expect(records[0]).toEqual({ id: 'x' });
      expect(getOrRecompute).not.toHaveBeenCalled();
    });
  });
});
