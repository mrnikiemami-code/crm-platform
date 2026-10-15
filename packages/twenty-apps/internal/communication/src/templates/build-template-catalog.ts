import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  probeAuthorizedFieldTokens,
  restrictCatalogToAuthorizedTokens,
} from 'src/templates/probe-readable-fields';
import {
  buildTemplateVariableCatalog,
  EMPTY_TEMPLATE_VARIABLE_CATALOG,
  type TemplateValueKind,
  type TemplateVariableCatalog,
  type TemplateVariableGroup,
  type TemplateVariableDefinition,
} from 'src/templates/template-variable-catalog';

// Builds the template variable catalog from the workspace's OWN metadata.
//
// This replaces the former hard-coded catalog: the available tokens are the
// fields that actually exist on Person and Company in THIS workspace, including
// custom fields, filtered to a safe scalar shape and to what the app's role may
// read. The same catalog feeds the template Variables page, preview, the single
// send and the bulk send.
//
// Security model (three layers, all server-side):
//  1. TYPE allow-list — only closed scalar shapes with a defined text extractor
//     are admitted. Relations, files, addresses, phones, arrays, actors, rich
//     text, raw JSON, positions, search vectors and UUIDs are never exposed, so
//     there is no collection, file or complex value to leak.
//  2. NAME filtering — system/audit fields and anything matching a
//     secret-looking name are excluded even when their type would be allowed.
//  3. PERMISSIONS — the app's own execution role is read from metadata and any
//     object it cannot read, any explicitly restricted field, and any field
//     whose `canReadFieldValue` is false are excluded.
//
// The catalog only ever yields an `objectName` + `fieldName` (+ `subFieldName`)
// pair that was read from metadata; a record read is built from those names and
// nothing else, so client-supplied token text can never become a selection.

// Types admitted into the catalog, mapped to their text-extraction kind. Every
// other FieldMetadataType is deliberately absent.
const SAFE_SCALAR_KIND_BY_TYPE: Record<string, TemplateValueKind> = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  NUMERIC: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  DATE_TIME: 'DATE',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  RATING: 'RATING',
  CURRENCY: 'CURRENCY',
  LINKS: 'LINKS',
  EMAILS: 'EMAILS',
};

// Audit/system fields that would otherwise pass the type filter.
const BLOCKED_FIELD_NAMES = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'avatarUrl',
  'searchVector',
]);

// A field whose NAME looks like a credential is never exposed, whatever its
// type or its permissions say.
const SECRET_FIELD_NAME_PATTERN =
  /(secret|password|passcode|token|apikey|api_key|credential|private_?key|access_?key)/i;

// A GraphQL selection key must be a plain identifier. A metadata field name
// that is not one is skipped rather than quoted or escaped.
const SAFE_FIELD_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

// The six legacy aliases, attached to the canonical definitions that replaced
// them. Saved templates that use the old names keep resolving to the SAME value.
const LEGACY_FIRST_NAME_ALIASES = ['name', 'firstName'] as const;
const LEGACY_LAST_NAME_ALIASES = ['lastName'] as const;
const LEGACY_FULL_NAME_ALIASES = ['fullName'] as const;
const LEGACY_COMPANY_NAME_ALIASES = ['company', 'companyName'] as const;

/** The subset of object metadata this builder needs. */
export type TemplateMetadataField = {
  id: string;
  name: string;
  type: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
};

export type TemplateMetadataObject = {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelPlural: string;
  fields: TemplateMetadataField[];
};

/**
 * The template's resolved SOURCE, as the catalog needs it.
 *
 * Every value here was resolved server-side from the workspace's metadata (or
 * from the template's stored identifiers) BEFORE the catalog is built. Nothing
 * in this object comes from the client, so it cannot be used to make the catalog
 * read an object the caller did not already have access to.
 */
export type TemplateCatalogSource = {
  /**
   * The source object's `nameSingular`. The builder resolves the object (and its
   * workspace label) from metadata itself, so this is the ONLY thing a caller
   * supplies — and it is always derived server-side from the template's stored
   * or eligible source, never from a raw client value.
   */
  objectName: string;
};

/** The app execution role's permission projection. */
export type TemplatePermissionSnapshot = {
  /** True when the role is not restricted per object. */
  canReadAllObjectRecords: boolean;
  /** Objects the role may not read, or whose fields are restricted. */
  objectPermissions: {
    objectMetadataId: string;
    canReadObjectRecords: boolean | undefined;
    restrictedFieldNames: string[];
    restrictedFieldMetadataIds: string[];
  }[];
  /** Fields the role may not read, by field metadata id. */
  unreadableFieldMetadataIds: string[];
};

/** The outcome of building the authorized catalog. */
export type AuthorizedTemplateCatalogResult = {
  /** EMPTY when `isAvailable` is false. */
  catalog: TemplateVariableCatalog;
  /**
   * The SOURCE object's workspace label (`labelPlural`), resolved from metadata.
   * It titles the source group, so the server decides the heading instead of a
   * client-supplied display string.
   */
  sourceLabelPlural: string;
  /**
   * False when the metadata or the role/permission read failed. Callers must
   * report a stable unavailable state instead of advertising zero fields as if
   * the workspace simply had none.
   */
  isAvailable: boolean;
  /**
   * A STABLE, application-owned marker of which step produced the unavailable
   * state. It carries no exception text, URL, credential or SDK detail, and
   * exists so an operator can tell "metadata unreadable" apart from "role
   * unreadable" without a raw error ever reaching a client.
   */
  stage: AuthorizedTemplateCatalogStage;
};

export const AUTHORIZED_CATALOG_STAGE = {
  OK: 'OK',
  METADATA_ERROR: 'METADATA_ERROR',
  ROLE_QUERY_ERROR: 'ROLE_QUERY_ERROR',
  READ_PROBE_ERROR: 'READ_PROBE_ERROR',
  /**
   * @deprecated No longer produced. The probe, not role metadata, is the
   * authority, so "the role could not be read" is not a case that can occur. A
   * catalog with nothing authorized for its source is SOURCE_UNAVAILABLE.
   */
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  /**
   * The requested source object is not an active object in this workspace.
   *
   * Reported as its own stage so the editor can say "this source is not
   * available" rather than silently showing Person variables: an unresolvable
   * source must never fall back.
   */
  SOURCE_UNKNOWN: 'SOURCE_UNKNOWN',
  /**
   * The source object exists but NO field of it could be authorized, or (for a
   * related source) no field of the recipient Person could be. Typically there
   * is no readable record of that object to prove access against.
   */
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
} as const;

export type AuthorizedTemplateCatalogStage =
  (typeof AUTHORIZED_CATALOG_STAGE)[keyof typeof AUTHORIZED_CATALOG_STAGE];

/**
 * The candidate-build permissions. Deliberately unrestricted at the METADATA
 * layer: the actual authorization comes from the probe record read, so applying
 * a second, unverifiable restriction here would only be guesswork.
 */
export const UNRESTRICTED_TEMPLATE_PERMISSIONS: TemplatePermissionSnapshot = {
  canReadAllObjectRecords: true,
  objectPermissions: [],
  unreadableFieldMetadataIds: [],
};

// `restrictedFields` is a JSON column; its exact shape is a platform detail, so
// it is read defensively: entries may be plain field names or objects carrying
// a name / field metadata id.
const readRestrictedFields = (
  value: unknown,
): { names: string[]; ids: string[] } => {
  const names: string[] = [];
  const ids: string[] = [];

  if (!Array.isArray(value)) {
    return { names, ids };
  }

  for (const entry of value) {
    if (typeof entry === 'string') {
      names.push(entry);
      continue;
    }

    if (entry !== null && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;

      if (typeof record.name === 'string') {
        names.push(record.name);
      }

      const id = record.fieldMetadataId ?? record.id;

      if (typeof id === 'string') {
        ids.push(id);
      }
    }
  }

  return { names, ids };
};

const isSafeField = (
  field: TemplateMetadataField,
  allowedNames: Set<string>,
): boolean => {
  if (!field.isActive) {
    return false;
  }

  if (!SAFE_FIELD_NAME_PATTERN.test(field.name)) {
    return false;
  }

  if (BLOCKED_FIELD_NAMES.has(field.name)) {
    return false;
  }

  if (SECRET_FIELD_NAME_PATTERN.test(field.name)) {
    return false;
  }

  return allowedNames.has(field.type);
};

/**
 * Builds the catalog. PURE: metadata and permissions are passed in, so the
 * selection rules can be tested without a workspace.
 *
 * Permissions are REQUIRED (non-null). A role that could not be read must never
 * be treated as "allow everything": the caller returns an EMPTY catalog and a
 * stable unavailable status instead (see `buildAuthorizedTemplateCatalog`).
 *
 * Object readability follows the PLATFORM's own resolved semantics:
 * `objectPermission.canReadObjectRecords ?? role.canReadAllObjectRecords`
 * (verified in `workspace-roles-permissions-cache.service.ts` / the object
 * permission consistency validator). So a role with `canReadAllObjectRecords:
 * false` and no per-object override can read NOTHING, and an explicit override
 * wins in both directions.
 */
export const buildTemplateCatalogFromMetadata = ({
  objects,
  permissions,
  source,
}: {
  objects: readonly TemplateMetadataObject[];
  permissions: TemplatePermissionSnapshot;
  source: TemplateCatalogSource;
}): TemplateVariableCatalog => {
  const objectByName = new Map(
    objects.map((object) => [object.nameSingular, object]),
  );

  // Defense in depth: a source the workspace does not define yields NOTHING.
  // Without this the company group alone would still be emitted, producing a
  // catalog for a source that does not exist — the silent-degradation shape this
  // task removes. The runtime entry point reports the same case as
  // SOURCE_UNKNOWN before it ever reaches here.
  if (!objectByName.has(source.objectName)) {
    return EMPTY_TEMPLATE_VARIABLE_CATALOG;
  }

  const readOverrideByObjectId = new Map<string, boolean>();
  const restrictedNamesByObjectId = new Map<string, Set<string>>();
  const restrictedIdsByObjectId = new Map<string, Set<string>>();

  for (const permission of permissions.objectPermissions) {
    if (permission.canReadObjectRecords !== undefined) {
      readOverrideByObjectId.set(
        permission.objectMetadataId,
        permission.canReadObjectRecords,
      );
    }

    if (permission.restrictedFieldNames.length > 0) {
      restrictedNamesByObjectId.set(
        permission.objectMetadataId,
        new Set(permission.restrictedFieldNames),
      );
    }

    if (permission.restrictedFieldMetadataIds.length > 0) {
      restrictedIdsByObjectId.set(
        permission.objectMetadataId,
        new Set(permission.restrictedFieldMetadataIds),
      );
    }
  }

  const unreadableFieldIds = new Set(
    permissions.unreadableFieldMetadataIds,
  );

  const isObjectReadable = (objectId: string): boolean =>
    readOverrideByObjectId.get(objectId) ??
    permissions.canReadAllObjectRecords;

  /**
   * Builds the entries for ONE object, under an explicit token PREFIX and group.
   *
   * The prefix and the object are separate on purpose: the source object's fields
   * are addressed as `source.*` while the recipient Person's are `person.*`, yet
   * both are read through a real metadata `nameSingular`. For a Person SOURCE the
   * prefix is `person`, because the source record then *is* the recipient — which
   * is exactly why that case yields a single group instead of the same fields
   * listed twice.
   */
  const buildEntriesForObject = ({
    objectName,
    prefix,
    group,
  }: {
    objectName: string;
    prefix: string;
    group: TemplateVariableGroup;
  }): TemplateVariableDefinition[] => {
    const object = objectByName.get(objectName);

    if (object === undefined || !isObjectReadable(object.id)) {
      return [];
    }

    const restrictedNames = restrictedNamesByObjectId.get(object.id);
    const restrictedIds = restrictedIdsByObjectId.get(object.id);
    const allowedNames = new Set(Object.keys(SAFE_SCALAR_KIND_BY_TYPE));

    const entries: TemplateVariableDefinition[] = [];

    for (const field of object.fields) {
      if (!isSafeField(field, allowedNames)) {
        continue;
      }

      if (restrictedNames?.has(field.name) === true) {
        continue;
      }

      if (restrictedIds?.has(field.id) === true) {
        continue;
      }

      if (unreadableFieldIds.has(field.id)) {
        continue;
      }

      const isCompanyName = objectName === 'company' && field.name === 'name';

      entries.push({
        token: `${prefix}.${field.name}`,
        // Only the Company's name carries aliases: `@company` / `@companyName`
        // are legacy spellings of it, and saved templates use them.
        aliases: isCompanyName ? LEGACY_COMPANY_NAME_ALIASES : [],
        label: isCompanyName ? 'Company name' : field.label,
        objectName,
        fieldName: field.name,
        kind: SAFE_SCALAR_KIND_BY_TYPE[field.type],
        group,
      });
    }

    return entries;
  };

  /**
   * The Person's three name tokens, derived from the workspace's OWN FULL_NAME
   * field. Absent when the workspace has none, or the field is unreadable.
   */
  const buildFullNameEntries = ({
    objectName,
    prefix,
    group,
    withLegacyAliases,
  }: {
    objectName: string;
    prefix: string;
    group: TemplateVariableGroup;
    withLegacyAliases: boolean;
  }): TemplateVariableDefinition[] => {
    const object = objectByName.get(objectName);
    const fullNameField = object?.fields.find(
      (field) => field.type === 'FULL_NAME',
    );

    const isUsable =
      object !== undefined &&
      isObjectReadable(object.id) &&
      fullNameField !== undefined &&
      restrictedNamesByObjectId.get(object.id)?.has(fullNameField.name) !== true &&
      restrictedIdsByObjectId.get(object.id)?.has(fullNameField.id) !== true &&
      !unreadableFieldIds.has(fullNameField.id);

    if (!isUsable) {
      return [];
    }

    return [
      {
        token: `${prefix}.firstName`,
        aliases: withLegacyAliases ? LEGACY_FIRST_NAME_ALIASES : [],
        label: 'First name',
        objectName,
        fieldName: fullNameField!.name,
        subFieldName: 'firstName',
        kind: 'FULL_NAME',
        group,
      },
      {
        token: `${prefix}.lastName`,
        aliases: withLegacyAliases ? LEGACY_LAST_NAME_ALIASES : [],
        label: 'Last name',
        objectName,
        fieldName: fullNameField!.name,
        subFieldName: 'lastName',
        kind: 'FULL_NAME',
        group,
      },
      {
        token: `${prefix}.fullName`,
        aliases: withLegacyAliases ? LEGACY_FULL_NAME_ALIASES : [],
        label: 'Full name',
        objectName,
        fieldName: fullNameField!.name,
        subFieldName: 'fullName',
        kind: 'FULL_NAME',
        group,
      },
    ];
  };

  const isPersonSource = source.objectName === 'person';

  // --- the SOURCE RECORD's own fields -------------------------------------
  // For a Person source the prefix is `person` and the legacy aliases hang here,
  // because the record IS the recipient.
  const sourceEntries = [
    ...buildFullNameEntries({
      objectName: source.objectName,
      prefix: isPersonSource ? 'person' : 'source',
      group: 'source',
      withLegacyAliases: isPersonSource,
    }),
    ...buildEntriesForObject({
      objectName: source.objectName,
      prefix: isPersonSource ? 'person' : 'source',
      group: 'source',
    }),
  ];

  // --- the RECIPIENT PERSON's fields --------------------------------------
  // Omitted for a Person source: those are the same fields, and listing them
  // twice is the duplication that made the old picker confusing.
  const recipientEntries = isPersonSource
    ? []
    : [
        ...buildFullNameEntries({
          objectName: 'person',
          prefix: 'person',
          group: 'recipient',
          withLegacyAliases: true,
        }),
        ...buildEntriesForObject({
          objectName: 'person',
          prefix: 'person',
          group: 'recipient',
        }),
      ];

  // --- the recipient's COMPANY -------------------------------------------
  // Kept for every source, because it is what the six legacy aliases and the
  // existing saved templates (`@company`, `@company.name`) resolve through.
  const companyEntries = [
    ...buildEntriesForObject({
      objectName: 'company',
      prefix: 'company',
      group: 'company',
    }),
  ];

  return buildTemplateVariableCatalog([
    ...sourceEntries,
    ...recipientEntries,
    ...companyEntries,
  ]);
};

// --- the runtime readers -----------------------------------------------------

type RawMetadataField = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  label?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
};

type RawMetadataObject = {
  id?: string | null;
  nameSingular?: string | null;
  namePlural?: string | null;
  labelPlural?: string | null;
  fieldsList?: RawMetadataField[] | null;
};

/** Reads the workspace object/field metadata through the metadata API. */
export const readTemplateMetadataObjects = async ({
  metadataClient,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
}): Promise<TemplateMetadataObject[]> => {
  const result = await metadataClient.query({
    objects: {
      __args: { paging: { first: 200 }, filter: {} },
      edges: {
        node: {
          id: true,
          nameSingular: true,
          namePlural: true,
          labelPlural: true,
          fieldsList: {
            id: true,
            name: true,
            type: true,
            label: true,
            isActive: true,
            isSystem: true,
          },
        },
      },
    },
  });

  const nodes: RawMetadataObject[] =
    (result.objects?.edges ?? [])
      .map((edge) => edge?.node as RawMetadataObject | null | undefined)
      .filter(
        (node): node is RawMetadataObject => node !== null && node !== undefined,
      );

  return nodes
    .filter(
      (node): node is RawMetadataObject & {
        id: string;
        nameSingular: string;
      } =>
        typeof node.id === 'string' && typeof node.nameSingular === 'string',
    )
    .map((node) => ({
      id: node.id,
      nameSingular: node.nameSingular,
      namePlural:
        typeof node.namePlural === 'string' && node.namePlural.length > 0
          ? node.namePlural
          : node.nameSingular,
      labelPlural:
        typeof node.labelPlural === 'string' && node.labelPlural.length > 0
          ? node.labelPlural
          : node.nameSingular,
      fields: (node.fieldsList ?? [])
        .filter(
          (field): field is RawMetadataField & {
            id: string;
            name: string;
            type: string;
          } =>
            typeof field.id === 'string' &&
            typeof field.name === 'string' &&
            typeof field.type === 'string',
        )
        .map((field) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          label: typeof field.label === 'string' ? field.label : field.name,
          isActive: field.isActive !== false,
          isSystem: field.isSystem === true,
        })),
    }));
};

/**
 * Reads the permissions of the role the app ACTUALLY executes as.
 *
 * Why two sources. The app's role is identified authoritatively by the
 * `Application` row's `defaultRoleId` — on this platform build
 * `defaultLogicFunctionRole` is `null` even when `defaultRoleId` is set, so
 * relying on the nested field alone silently produced no role and made the whole
 * catalog fail closed. The permissions themselves are then read from the
 * workspace role list (`getRoles`, a plain workspace-scoped metadata query) and
 * matched to that id, falling back to the app's declared role universal
 * identifier.
 *
 * Returns `null` when NO role can be resolved, which the caller turns into an
 * EMPTY, unavailable catalog: a permission lookup that fails must fail CLOSED,
 * never advertise fields, and never assume "allow everything".
 */
export const readTemplatePermissions = async ({
  metadataClient,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
}): Promise<TemplatePermissionSnapshot | null> => {
  const rolesResult = await metadataClient.query({
    getRoles: {
      id: true,
      universalIdentifier: true,
      canReadAllObjectRecords: true,
      objectPermissions: {
        objectMetadataId: true,
        canReadObjectRecords: true,
        restrictedFields: true,
      },
      fieldPermissions: {
        fieldMetadataId: true,
        canReadFieldValue: true,
      },
    },
  });

  const roles = rolesResult.getRoles ?? [];

  // The Application row's `defaultRoleId` is the precise pointer, but reading it
  // is a SEPARATE, optional query: on some platform builds the app token may not
  // read `Application` records, and a failure there must not invalidate a role
  // that the role list already gave us. Either source failing is survivable; the
  // declared role identifier is the always-available anchor.
  let preferredRoleId: string | null = null;

  try {
    const application = await metadataClient.query({
      findOneApplication: {
        __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        defaultRoleId: true,
      },
    });

    preferredRoleId = application.findOneApplication?.defaultRoleId ?? null;
  } catch {
    preferredRoleId = null;
  }

  const role =
    (preferredRoleId === null
      ? undefined
      : roles.find((candidate) => candidate.id === preferredRoleId)) ??
    roles.find(
      (candidate) =>
        candidate.universalIdentifier ===
        DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
    );

  if (role === undefined) {
    return null;
  }

  return {
    canReadAllObjectRecords: role.canReadAllObjectRecords === true,
    objectPermissions: (role.objectPermissions ?? []).map((permission) => {
      const restricted = readRestrictedFields(permission.restrictedFields);

      return {
        objectMetadataId: permission.objectMetadataId,
        canReadObjectRecords: permission.canReadObjectRecords ?? undefined,
        restrictedFieldNames: restricted.names,
        restrictedFieldMetadataIds: restricted.ids,
      };
    }),
    unreadableFieldMetadataIds: (role.fieldPermissions ?? [])
      .filter((permission) => permission.canReadFieldValue === false)
      .map((permission) => permission.fieldMetadataId),
  };
};

/**
 * The single server-authoritative entry point every consumer uses.
 *
 * FAIL CLOSED, and authorized by the platform's OWN record read.
 *
 * Why not the role metadata: an app-scoped token cannot read workspace roles
 * (`getRoles`) or application role rows on this platform build — verified live on
 * main/4D, where every such query is denied with "Entity performing the request
 * does not have permission". So the app cannot derive field-level access from
 * role metadata, and pretending to would be a fiction.
 *
 * What is authoritative instead: the platform enforces access on the ACTUAL
 * record read. A probe read of one accessible Person therefore reports exactly
 * which candidate fields this caller may read — a readable-but-empty field comes
 * back as `null`, while a field the caller may NOT read is absent from the
 * response entirely. The catalog is the CANDIDATE metadata catalog restricted to
 * the fields that read actually returned.
 *
 * Consequences, stated honestly:
 *  - Fields are never advertised merely because metadata enumeration succeeded;
 *    advertising requires a successful authorized read.
 *  - A workspace with no readable Person yields an EMPTY, UNAVAILABLE catalog,
 *    which is safe (there is nothing to template against) and never guesses.
 *  - Record reads stay server-authoritative; every probe is a bounded read and
 *    writes nothing. Probes run with bounded concurrency.
 */
export const buildAuthorizedTemplateCatalog = async ({
  metadataClient,
  client,
  source,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
  client: Pick<CoreApiClient, 'query'>;
  source: TemplateCatalogSource;
}): Promise<AuthorizedTemplateCatalogResult> => {
  let objects: TemplateMetadataObject[];

  try {
    objects = await readTemplateMetadataObjects({ metadataClient });
  } catch {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: '',
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.METADATA_ERROR,
    };
  }

  // The source must exist as an ACTIVE object in this workspace's metadata. When
  // it does not, the catalog is EMPTY and explicitly SOURCE_UNKNOWN — never
  // silently rebuilt around Person, which is the defect this guards.
  const sourceObject = objects.find(
    (object) => object.nameSingular === source.objectName,
  );

  if (sourceObject === undefined) {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: '',
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.SOURCE_UNKNOWN,
    };
  }

  // The group title is the workspace's own label for the source object, so it
  // reads in the workspace's words rather than a generic heading.
  const resolvedSource: TemplateCatalogSource = {
    objectName: sourceObject.nameSingular,
  };

  // The candidate catalog: the SOURCE object's safe scalars, plus the recipient
  // Person's (and its Company's) for a related source. None of it is authorized
  // yet — each field must pass its OWN bounded read below.
  const candidates = buildTemplateCatalogFromMetadata({
    objects,
    permissions: UNRESTRICTED_TEMPLATE_PERMISSIONS,
    source: resolvedSource,
  });

  try {
    const probe = await probeAuthorizedFieldTokens({
      client,
      catalog: candidates,
      objectPluralNames: new Map(
        objects.map((object) => [object.nameSingular, object.namePlural]),
      ),
    });

    if (probe === null) {
      // Nothing at all could be authorized. Since the catalog is built for ONE
      // source, this genuinely means "nothing is usable for this source" — the
      // old `ROLE_NOT_FOUND` name dates from the role-metadata era, when the
      // role read (not the probe) was the authority.
      return {
        catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
        sourceLabelPlural: sourceObject.labelPlural,
        isAvailable: false,
        stage: AUTHORIZED_CATALOG_STAGE.SOURCE_UNAVAILABLE,
      };
    }

    const authorized = restrictCatalogToAuthorizedTokens(
      candidates,
      probe.authorizedTokens,
    );

    // The SOURCE group must survive its own probes. Without it the editor would
    // be showing only the recipient's fields for a source the user picked, which
    // is the "Person variables for a non-Person source" failure by another route.
    const hasSourceVariables = authorized.variables.some(
      (variable) => variable.group === 'source',
    );

    if (!hasSourceVariables) {
      return {
        catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
        sourceLabelPlural: sourceObject.labelPlural,
        isAvailable: false,
        stage: AUTHORIZED_CATALOG_STAGE.SOURCE_UNAVAILABLE,
      };
    }

    return {
      catalog: authorized,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: true,
      stage: AUTHORIZED_CATALOG_STAGE.OK,
    };
  } catch {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: '',
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.READ_PROBE_ERROR,
    };
  }
};
