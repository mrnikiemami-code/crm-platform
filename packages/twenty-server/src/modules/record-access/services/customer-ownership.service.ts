import { Injectable } from '@nestjs/common';
import { isNonEmptyArray, isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

export const CUSTOMER_OBJECT_NAME_SINGULAR = 'person';
export const CUSTOMER_OWNER_FIELD_NAME = 'assignee';

type CustomerPath =
  // The record names its customer directly (`personId`).
  | { kind: 'direct'; fieldName: string }
  // The record names a row that names its customer (`eventRegistrationId`).
  | {
      kind: 'via';
      fieldName: string;
      objectNameSingular: string;
      customerFieldName: string;
    };

type DependentObjectConfig = {
  ownerColumnName: string;
  customerPath: CustomerPath;
};

/**
 * The four records that inherit their owner from a customer, and how to walk
 * from each one to that customer.
 *
 * Kept here rather than derived from metadata because the app's own trigger
 * uses the same four names: if one side ever changed without the other, the
 * drift report in the install command would surface it.
 */
const DEPENDENT_OBJECT_CONFIG: Record<string, DependentObjectConfig> = {
  eventLead: {
    ownerColumnName: 'assignedToId',
    customerPath: { kind: 'direct', fieldName: 'personId' },
  },
  eventRegistration: {
    ownerColumnName: 'assigneeId',
    customerPath: { kind: 'direct', fieldName: 'personId' },
  },
  registrationPayment: {
    ownerColumnName: 'assigneeId',
    customerPath: {
      kind: 'via',
      fieldName: 'eventRegistrationId',
      objectNameSingular: 'eventRegistration',
      customerFieldName: 'personId',
    },
  },
  salesInteraction: {
    ownerColumnName: 'assigneeId',
    customerPath: {
      kind: 'via',
      fieldName: 'eventLeadId',
      objectNameSingular: 'eventLead',
      customerFieldName: 'personId',
    },
  },
};

export const isDependentObjectWithOwner = (objectNameSingular: string): boolean =>
  isDefined(DEPENDENT_OBJECT_CONFIG[objectNameSingular]);

/**
 * A relation is readable as either its join column (`assigneeId`) or the loaded
 * object (`assignee.id`); both name the same member.
 */
const readRelationOwner = (
  record: unknown,
  fieldName: string,
): string | null => {
  const joinColumnValue = readJoinColumn(record, `${fieldName}Id`);

  return joinColumnValue ?? readJoinColumn(record, fieldName);
};

/** Reads a value that is itself a column name (`personId`) or a nested id. */
const readJoinColumn = (record: unknown, columnName: string): string | null => {
  if (record === null || typeof record !== 'object') {
    return null;
  }

  const values = record as Record<string, unknown>;
  const columnValue = values[columnName];

  if (typeof columnValue === 'string' && columnValue.length > 0) {
    return columnValue;
  }

  const relationValue = values[columnName.replace(/Id$/, '')];

  if (relationValue !== null && typeof relationValue === 'object') {
    const nestedId = (relationValue as { id?: unknown }).id;

    return typeof nestedId === 'string' ? nestedId : null;
  }

  return null;
};

/**
 * Decides whether the acting member is confined to the customers assigned to
 * them, and stamps the owner on a customer or dependent record such a member
 * creates.
 *
 * WHY THE ROLE, NOT ITS LABEL: being a "manager" is not a name. The only signal
 * that changes behaviour is whether the member's role carries a row-level rule
 * on the customer, because that rule is what actually hides other people's rows
 * from every read. A role without it already sees every customer, so it may also
 * hand one to somebody else; a role with it cannot see a customer it does not
 * own, so it must not be able to choose the owner either — least of all its own
 * id on a record it did not own a moment ago.
 *
 * The owner is stamped on the server for the same reason: a client-supplied id
 * would let a restricted member point a record at a colleague.
 *
 * WHY DEPENDENT ROWS NEED IT TOO: the database trigger fills the owner, but the
 * ORM validates the row-level rule on the payload BEFORE the INSERT reaches the
 * trigger, so a row sent without an owner is refused even for the member's own
 * customer. That is exactly the quick-registration path — the app writes with
 * the triggering user's token. Stamping the owner here, only after reading the
 * customer under the caller's own permissions, keeps the rule as the single
 * authority: a customer the member cannot read yields no owner, and the write is
 * refused by the same rule it always was.
 */
@Injectable()
export class CustomerOwnershipService {
  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
  ) {}

  async resolveRowRestrictedMemberId(
    authContext: WorkspaceAuthContext,
  ): Promise<string | null> {
    // Confinement follows a PERSON, not a context label. A request made by an
    // application on somebody's behalf (a logic function the user triggered)
    // carries the same person and must be confined exactly like the UI; one that
    // carries nobody (pure application, api key, system) is a server-trusted path.
    const person = authContext as {
      userWorkspaceId?: string;
      workspaceMemberId?: string;
    };
    const userWorkspaceId = person.userWorkspaceId ?? null;
    const workspaceMemberId = person.workspaceMemberId ?? null;

    if (userWorkspaceId === null || workspaceMemberId === null) {
      return null;
    }

    const { workspace } = authContext;

    const { userWorkspaceRoleMap, rolesPermissions, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspace.id, [
        'userWorkspaceRoleMap',
        'rolesPermissions',
        'flatObjectMetadataMaps',
      ]);

    // Everything below fails CLOSED: when the role cannot be resolved the
    // member is treated as restricted, so a metadata hiccup can never turn into
    // an ownership assignment it should not have made.
    const roleId = userWorkspaceRoleMap[userWorkspaceId];

    if (!isDefined(roleId)) {
      return workspaceMemberId;
    }

    const { idByNameSingular } = buildObjectIdByNameMaps(flatObjectMetadataMaps);
    const customerObjectMetadataId =
      idByNameSingular[CUSTOMER_OBJECT_NAME_SINGULAR];

    if (!isDefined(customerObjectMetadataId)) {
      return workspaceMemberId;
    }

    const customerPermissions =
      rolesPermissions[roleId]?.[customerObjectMetadataId];

    if (!isDefined(customerPermissions)) {
      return workspaceMemberId;
    }

    return isNonEmptyArray(customerPermissions.rowLevelPermissionPredicates)
      ? workspaceMemberId
      : null;
  }

  async assignOwnerToCreatedCustomers({
    authContext,
    records,
  }: {
    authContext: WorkspaceAuthContext;
    records: Array<Record<string, unknown>>;
  }): Promise<void> {
    if (!isNonEmptyArray(records)) {
      return;
    }

    const restrictedMemberId =
      await this.resolveRowRestrictedMemberId(authContext);

    if (!isDefined(restrictedMemberId)) {
      return;
    }

    for (const record of records) {
      // A relation the client may have sent nested would win over the column.
      delete record[CUSTOMER_OWNER_FIELD_NAME];
      record[`${CUSTOMER_OWNER_FIELD_NAME}Id`] = restrictedMemberId;
    }
  }

  /**
   * Stamps the owner on created dependents whose customer the acting member
   * owns. A dependent of a customer the member cannot read is left without an
   * owner on purpose: the row-level rule then refuses the write with the same
   * message it gives for any record outside the member's scope.
   */
  async assignOwnerToCreatedDependents({
    authContext,
    objectNameSingular,
    records,
  }: {
    authContext: WorkspaceAuthContext;
    objectNameSingular: string;
    records: Array<Record<string, unknown>>;
  }): Promise<void> {
    const config = DEPENDENT_OBJECT_CONFIG[objectNameSingular];

    if (!isDefined(config) || !isNonEmptyArray(records)) {
      return;
    }

    const restrictedMemberId =
      await this.resolveRowRestrictedMemberId(authContext);

    if (!isDefined(restrictedMemberId)) {
      return;
    }

    const ownerFieldName = config.ownerColumnName.replace(/Id$/, '');

    for (const record of records) {
      // Nothing a client sent may survive here; the value below is the only one
      // this method is allowed to produce.
      delete record[config.ownerColumnName];
      delete record[ownerFieldName];
    }

    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      // Read plumbing is bypassed on purpose: the ONLY thing this read decides is
      // whether the referenced customer belongs to the acting member, and that
      // comparison IS the restriction. Filtering the read by the same rule would
      // make the answer depend on a second evaluation of it, and a null here
      // would silently turn into "no owner" instead of "not yours".
      const personRepository = this.workspaceOrmManager.getRepository('person', {
        shouldBypassPermissionChecks: true,
      });

      for (const record of records) {
        const personId = await this.resolveCustomerId(config, record);

        if (!isDefined(personId)) {
          continue;
        }

        // Read through the caller's own permissions: a customer they cannot see
        // is simply not found, and the owner stays unset.
        const customer = await personRepository.findOne({
          where: { id: personId },
        });

        if (readRelationOwner(customer, CUSTOMER_OWNER_FIELD_NAME) === restrictedMemberId) {
          record[config.ownerColumnName] = restrictedMemberId;
        }
      }
    }, authContext);
  }

  private async resolveCustomerId(
    config: DependentObjectConfig,
    record: Record<string, unknown>,
  ): Promise<string | null> {
    const { customerPath } = config;
    const referencedId = record[customerPath.fieldName];

    if (typeof referencedId !== 'string' || referencedId.length === 0) {
      return null;
    }

    if (customerPath.kind === 'direct') {
      return referencedId;
    }

    const hopRepository = this.workspaceOrmManager.getRepository(
      customerPath.objectNameSingular,
      { shouldBypassPermissionChecks: true },
    );
    const hop = await hopRepository.findOne({
      where: { id: referencedId },
    });

    return readJoinColumn(hop, customerPath.customerFieldName);
  }
}
