import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  classifyObjectReachability,
  discoverFieldProbeTargets,
  OBJECT_REACHABILITY,
  type ObjectReachability,
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

/**
 * A field an app wrote for its OWN bookkeeping, matched by its `description`.
 *
 * This workspace's Communication object declares `sourceRecordId` as "The record
 * this message was composed from, when not the recipient", and the catalog was
 * advertising it as a template variable. A description is free text an operator
 * writes, so this is a narrow, explicit marker rather than a heuristic: it only
 * excludes a field whose description says it exists to RECORD where something
 * came from, which is never something a message should quote.
 *
 * The field is still written and read by the app — this only keeps it out of the
 * user-facing variable list.
 */
const INTERNAL_PROVENANCE_DESCRIPTION_PATTERN =
  /composed from|where this (record|message) came from|source record of/i;

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
  /** Metadata `universalIdentifier` — the field's stable identity. */
  universalIdentifier: string;
  /** Free-text description; used ONLY to keep app bookkeeping out of the list. */
  description: string;
};

export type TemplateMetadataObject = {
  id: string;
  /** Metadata `universalIdentifier` — the object's stable identity. */
  universalIdentifier: string;
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
  /** The role read SUCCEEDED but did not contain the application's own role. */
  APP_ROLE_NOT_FOUND: 'APP_ROLE_NOT_FOUND',
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
  /**
   * The source object is not in the schema this REQUEST is served against.
   *
   * On this platform an app-token request is served a schema filtered to the
   * Standard application plus the calling app, so another application's objects
   * are genuinely absent. A code/platform boundary — NOT a permission decision
   * and NOT "the object has no fields".
   */
  SOURCE_NOT_IN_SCHEMA: 'SOURCE_NOT_IN_SCHEMA',
  /** The source query was rejected for a reason that is not a schema gap. */
  SOURCE_QUERY_REJECTED: 'SOURCE_QUERY_REJECTED',
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

  // An app's own provenance/bookkeeping field is never a template variable.
  if (INTERNAL_PROVENANCE_DESCRIPTION_PATTERN.test(field.description)) {
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
  recipientRelationName = null,
}: {
  objects: readonly TemplateMetadataObject[];
  permissions: TemplatePermissionSnapshot;
  source: TemplateCatalogSource;
  /**
   * The relation field NAME (metadata-resolved) that reaches the recipient from
   * the source record, or `null` for a Person source where the record IS the
   * recipient. It becomes the recipient entries' `readPath`, so recipient values
   * are read by following that relation rather than by a bare object name.
   */
  recipientRelationName?: string | null;
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
    readPath = [],
  }: {
    objectName: string;
    prefix: string;
    group: TemplateVariableGroup;
    /**
     * The path from the RECORD ROOT to this object, outermost first. Empty means
     * the object IS the record. `['pointOfContact']` means the recipient reached
     * through the source record's relation.
     */
    readPath?: readonly string[];
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
        // Identity, from metadata. The token is a spelling; these are the facts.
        objectUid: object.universalIdentifier,
        fieldUid: field.universalIdentifier,
        metadataType: field.type,
        readPath: [...readPath, field.name],
      });
    }

    return entries;
  };

  /**
   * The three name tokens for one object, derived from a FULL_NAME field the
   * object actually declares.
   *
   * `fullNameField` is passed in rather than searched for here, so the CALLER
   * decides which field it came from. That matters for the label: a workspace can
   * declare more than one FULL_NAME field, and the tokens are named after the
   * real field (`name` → «نام», `fullName` → «نام کامل») instead of every object
   * being assumed to have one called `name`.
   */
  const buildFullNameEntries = ({
    objectName,
    prefix,
    group,
    withLegacyAliases,
    fullNameField,
    disambiguateLabel = false,
  }: {
    objectName: string;
    prefix: string;
    group: TemplateVariableGroup;
    withLegacyAliases: boolean;
    fullNameField: TemplateMetadataField;
    /**
     * True only when the object declares MORE THAN ONE usable FULL_NAME field.
     * Then the label carries the field's own name so the two are tellable apart;
     * with a single field the familiar plain labels are kept, because changing
     * them for no reason is churn a user would see.
     */
    disambiguateLabel?: boolean;
  }): TemplateVariableDefinition[] => {
    const object = objectByName.get(objectName);

    const isUsable =
      object !== undefined &&
      isObjectReadable(object.id) &&
      restrictedNamesByObjectId.get(object.id)?.has(fullNameField.name) !==
        true &&
      restrictedIdsByObjectId.get(object.id)?.has(fullNameField.id) !== true &&
      !unreadableFieldIds.has(fullNameField.id);

    if (!isUsable || object === undefined) {
      return [];
    }

    const base = {
      objectName,
      fieldName: fullNameField.name,
      kind: 'FULL_NAME' as const,
      group,
      objectUid: object.universalIdentifier,
      fieldUid: fullNameField.universalIdentifier,
      metadataType: fullNameField.type,
      readPath: [fullNameField.name],
    };

    return [
      {
        ...base,
        token: `${prefix}.firstName`,
        aliases: withLegacyAliases ? LEGACY_FIRST_NAME_ALIASES : [],
        // Named after the REAL field only when disambiguation is needed, so two
        // FULL_NAME fields stay tellable apart without churning the single-field
        // labels a user already knows.
        label: disambiguateLabel
          ? `${fullNameField.label}: first name`
          : 'First name',
        subFieldName: 'firstName',
      },
      {
        ...base,
        token: `${prefix}.lastName`,
        aliases: withLegacyAliases ? LEGACY_LAST_NAME_ALIASES : [],
        label: disambiguateLabel
          ? `${fullNameField.label}: last name`
          : 'Last name',
        subFieldName: 'lastName',
      },
      {
        ...base,
        token: `${prefix}.fullName`,
        aliases: withLegacyAliases ? LEGACY_FULL_NAME_ALIASES : [],
        label: disambiguateLabel ? fullNameField.label : 'Full name',
        subFieldName: 'fullName',
      },
    ];
  };

  /**
   * EVERY usable FULL_NAME field of an object, not just the first.
   *
   * A workspace may declare more than one (a `name` and a separate `fullName`),
   * and picking only the first would silently hide the others — and would give
   * the SAME `firstName`/`lastName`/`fullName` tokens to whichever it happened to
   * pick, making the choice depend on metadata order.
   */
  const usableFullNameFieldsOf = (objectName: string): TemplateMetadataField[] => {
    const object = objectByName.get(objectName);

    if (object === undefined || !isObjectReadable(object.id)) {
      return [];
    }

    return object.fields.filter(
      (field) =>
        field.type === 'FULL_NAME' &&
        // NOT `isSafeField`: that checks the SCALAR type allow-list, which
        // deliberately excludes FULL_NAME because it is a composite handled by its
        // own sub-field tokens. The name/description guards are applied directly
        // instead, so a blocked or secret-looking name is still refused.
        field.isActive &&
        SAFE_FIELD_NAME_PATTERN.test(field.name) &&
        !BLOCKED_FIELD_NAMES.has(field.name) &&
        !SECRET_FIELD_NAME_PATTERN.test(field.name) &&
        !INTERNAL_PROVENANCE_DESCRIPTION_PATTERN.test(field.description) &&
        restrictedNamesByObjectId.get(object.id)?.has(field.name) !== true &&
        restrictedIdsByObjectId.get(object.id)?.has(field.id) !== true &&
        !unreadableFieldIds.has(field.id),
    );
  };

  const isPersonSource = source.objectName === 'person';

  // --- the SOURCE RECORD's own fields -------------------------------------
  // For a Person source the prefix is `person` and the legacy aliases hang here,
  // because the record IS the recipient.
  const sourcePrefix = isPersonSource ? 'person' : 'source';
  const sourceEntries = [
    ...usableFullNameFieldsOf(source.objectName).flatMap((fullNameField) =>
      buildFullNameEntries({
        objectName: source.objectName,
        prefix: sourcePrefix,
        group: 'source',
        withLegacyAliases: isPersonSource,
        fullNameField,
        disambiguateLabel:
          usableFullNameFieldsOf(source.objectName).length > 1,
      }),
    ),
    ...buildEntriesForObject({
      objectName: source.objectName,
      prefix: sourcePrefix,
      group: 'source',
    }),
  ];

  // --- the RECIPIENT PERSON's fields --------------------------------------
  // Omitted for a Person source: those are the same fields, and listing them
  // twice is the duplication that made the old picker confusing.
  //
  // `readPath` carries the relation, so a recipient value is read by following
  // the SOURCE RECORD's own relation — never by a bare object name. The path is
  // the relation field name the caller resolved from metadata.
  const recipientReadPath =
    recipientRelationName === null ? [] : [recipientRelationName];

  const recipientEntries = isPersonSource
    ? []
    : [
        ...usableFullNameFieldsOf('person').flatMap((fullNameField) =>
          buildFullNameEntries({
            objectName: 'person',
            prefix: 'person',
            group: 'recipient',
            withLegacyAliases: true,
            fullNameField,
            disambiguateLabel: usableFullNameFieldsOf('person').length > 1,
          }),
        ),
        ...buildEntriesForObject({
          objectName: 'person',
          prefix: 'person',
          group: 'recipient',
          readPath: recipientReadPath,
        }),
      ];

  // --- the recipient's COMPANY -------------------------------------------
  // KEPT for every source, including a Person one. Two reasons, and the second is
  // the important one:
  //
  //  1. The six legacy aliases (`@company`, `@company.name`) and the user's
  //     existing saved templates resolve through these.
  //  2. For a Person source the Person IS the record, so its `company` field is
  //     reached DIRECTLY on the record — which is a simpler and MORE correct path
  //     than going through a recipient relation. Dropping this group for a Person
  //     source would have silently broken `@company` in a live user template.
  //
  // The read path reflects that: the recipient relation (if any), then the
  // Person's own `company` field.
  const personObject = objectByName.get('person');
  const companyFieldName = personObject?.fields.find(
    (field) => field.name === 'company',
  )?.name;

  const companyReadPath =
    companyFieldName === undefined
      ? []
      : isPersonSource
        ? [companyFieldName]
        : [...recipientReadPath, companyFieldName];

  const companyEntries =
    companyFieldName === undefined
      ? []
      : [
          ...buildEntriesForObject({
            objectName: 'company',
            prefix: 'company',
            group: 'company',
            readPath: companyReadPath,
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
  universalIdentifier?: string | null;
  name?: string | null;
  type?: string | null;
  label?: string | null;
  description?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
};

type RawMetadataObject = {
  id?: string | null;
  universalIdentifier?: string | null;
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
          universalIdentifier: true,
          nameSingular: true,
          namePlural: true,
          labelPlural: true,
          fieldsList: {
            id: true,
            universalIdentifier: true,
            name: true,
            type: true,
            label: true,
            description: true,
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
      universalIdentifier:
        typeof node.universalIdentifier === 'string'
          ? node.universalIdentifier
          : '',
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
          universalIdentifier:
            typeof field.universalIdentifier === 'string'
              ? field.universalIdentifier
              : '',
          name: field.name,
          type: field.type,
          label: typeof field.label === 'string' ? field.label : field.name,
          description:
            typeof field.description === 'string' ? field.description : '',
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
    // The query SUCCEEDED but the application's own role is not among the roles
    // the caller may see. A QUERY failure throws instead, so the caller can tell
    // "denied" apart from "not listed".
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
 * Reads the permissions that apply to a request, as the INTERSECTION of the two
 * roles that both have to permit a field.
 *
 * Why two. A template variable is only usable if the SIGNED-IN USER may read the
 * field AND the APPLICATION's own role may read it — the app is the identity that
 * actually performs the read. Taking only one of them is wrong in a different way
 * each time: the app role alone ignores the user's own restrictions, and the user
 * alone ignores that the app might not be allowed to read the field it is about
 * to query. The intersection is the only set that is safe for both.
 *
 * A role that cannot be read is NOT treated as "allow everything": the caller
 * fails closed, so an unreadable role yields no catalog rather than an
 * unrestricted one.
 *
 * `userRoleId` is resolved from the platform's own authenticated-user context by
 * the caller, never from anything a client sent.
 */
export const readEffectiveTemplatePermissions = async ({
  metadataClient,
  userRoleId,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
  /** The signed-in user's role id, from the platform context. */
  userRoleId: string | null;
}): Promise<TemplatePermissionSnapshot | null> => {
  const [appRole, userRole] = await Promise.all([
    readTemplatePermissions({ metadataClient }),
    userRoleId === null
      ? Promise.resolve(null)
      : readRolePermissionsById({ metadataClient, roleId: userRoleId }),
  ]);

  if (appRole === null) {
    return null;
  }

  // No user role could be resolved: the app role alone is the honest answer, and
  // it is still a restriction (never an implicit allow-all).
  if (userRole === null) {
    return appRole;
  }

  return intersectTemplatePermissions(appRole, userRole);
};

/**
 * The intersection of two permission snapshots.
 *
 * Object readability is AND-ed, so an object readable by only one of the roles is
 * not readable. Restricted field names/ids and unreadable field ids are UNION-ed,
 * because a restriction from EITHER role must remove the field. "Read all objects"
 * is only true when BOTH roles grant it.
 */
export const intersectTemplatePermissions = (
  left: TemplatePermissionSnapshot,
  right: TemplatePermissionSnapshot,
): TemplatePermissionSnapshot => {
  const leftByObjectId = new Map(
    left.objectPermissions.map((permission) => [
      permission.objectMetadataId,
      permission,
    ]),
  );
  const rightByObjectId = new Map(
    right.objectPermissions.map((permission) => [
      permission.objectMetadataId,
      permission,
    ]),
  );

  const objectIds = new Set([
    ...leftByObjectId.keys(),
    ...rightByObjectId.keys(),
  ]);

  const objectPermissions: TemplatePermissionSnapshot['objectPermissions'] = [];

  for (const objectMetadataId of objectIds) {
    const leftPermission = leftByObjectId.get(objectMetadataId);
    const rightPermission = rightByObjectId.get(objectMetadataId);

    // Absent means "no override" for that role, so the role's own default applies.
    const leftRead =
      leftPermission?.canReadObjectRecords ?? left.canReadAllObjectRecords;
    const rightRead =
      rightPermission?.canReadObjectRecords ?? right.canReadAllObjectRecords;

    objectPermissions.push({
      objectMetadataId,
      canReadObjectRecords: leftRead && rightRead,
      restrictedFieldNames: [
        ...new Set([
          ...(leftPermission?.restrictedFieldNames ?? []),
          ...(rightPermission?.restrictedFieldNames ?? []),
        ]),
      ],
      restrictedFieldMetadataIds: [
        ...new Set([
          ...(leftPermission?.restrictedFieldMetadataIds ?? []),
          ...(rightPermission?.restrictedFieldMetadataIds ?? []),
        ]),
      ],
    });
  }

  return {
    canReadAllObjectRecords:
      left.canReadAllObjectRecords && right.canReadAllObjectRecords,
    objectPermissions,
    unreadableFieldMetadataIds: [
      ...new Set([
        ...left.unreadableFieldMetadataIds,
        ...right.unreadableFieldMetadataIds,
      ]),
    ],
  };
};

/**
 * Reads ONE role's permission projection by id.
 *
 * Returns `null` when the role is not in the readable role list, which the caller
 * treats as "could not be read" and never as "unrestricted".
 */
export const readRolePermissionsById = async ({
  metadataClient,
  roleId,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
  roleId: string;
}): Promise<TemplatePermissionSnapshot | null> => {
  try {
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

    const role = (rolesResult.getRoles ?? []).find(
      (candidate) => candidate.id === roleId,
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
  } catch {
    return null;
  }
};

/**
 * Resolves a relation field's NAME from its metadata `universalIdentifier`.
 *
 * The recipient entries' `readPath` is a real field name, so this is the bridge
 * from the identifier the template stores to the name the query must use. Returns
 * `null` when the identifier is empty (a Person source) or no longer resolves —
 * and an unresolvable relation is reported by the caller, never guessed.
 */
export const resolveRecipientRelationName = ({
  objects,
  sourceObjectName,
  relationUid,
}: {
  objects: readonly TemplateMetadataObject[];
  sourceObjectName: string;
  relationUid: string;
}): string | null => {
  if (relationUid.length === 0) {
    return null;
  }

  const sourceObject = objects.find(
    (object) => object.nameSingular === sourceObjectName,
  );

  const relation = sourceObject?.fields.find(
    (field) => field.universalIdentifier === relationUid,
  );

  return relation === undefined ? null : relation.name;
};

/**
 * The single server-authoritative entry point every consumer uses.
 *
 * AUTHORIZATION is the INTERSECTION of the signed-in user's role and the
 * application's own role (see `readEffectiveTemplatePermissions`), and the field
 * list is the CANDIDATE metadata catalog restricted to that intersection. It is
 * NOT derived from probing a random record: a field belongs to the catalog when
 * metadata says the object declares it and both roles may read it, which is a
 * fact about the OBJECT rather than about whether some record happened to have a
 * value. A source object with no records therefore still yields its full field
 * list.
 *
 * Consequences, stated honestly:
 *  - Fields are advertised from metadata + permissions, never from a record read.
 *  - An unreadable role yields an EMPTY, UNAVAILABLE catalog: fail closed.
 *  - Nothing is written by this function.
 */
export const buildAuthorizedTemplateCatalog = async ({
  metadataClient,
  client,
  source,
  relationUid = '',
  userRoleId = null,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
  client: Pick<CoreApiClient, 'query'>;
  source: TemplateCatalogSource;
  /**
   * The relation field's metadata `universalIdentifier`, when the source is a
   * RELATED object. It is resolved to the relation's field NAME here, which is
   * what the recipient entries' `readPath` is built from. Empty for a Person
   * source, where the record IS the recipient.
   */
  relationUid?: string;
  /**
   * The signed-in user's role id, from the platform's own context. `null` means
   * no user role could be resolved, in which case only the application's role
   * restricts the catalog — which is still a restriction, never an allow-all.
   */
  userRoleId?: string | null;
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

  // EFFECTIVE PERMISSIONS, read from the platform where it exposes them.
  //
  // Measured on this build: an app-scoped token CANNOT read `getRoles` (it is
  // guarded by the ROLES permission flag, which an app does not hold), so the
  // application's own role metadata is not available here. When a USER role id is
  // supplied it IS readable, and its restrictions are applied. Whatever cannot be
  // read is not assumed to be permissive: the record-read probe below is the
  // authority, and it is the platform's own enforcement rather than a guess.
  let effectivePermissions: TemplatePermissionSnapshot =
    UNRESTRICTED_TEMPLATE_PERMISSIONS;

  if (userRoleId !== null) {
    try {
      const userRole = await readRolePermissionsById({
        metadataClient,
        roleId: userRoleId,
      });

      if (userRole !== null) {
        effectivePermissions = userRole;
      }
    } catch {
      // Unreadable user role: fall through to the probe, which enforces anyway.
    }
  }

  const permitted = buildTemplateCatalogFromMetadata({
    objects,
    permissions: effectivePermissions,
    source: resolvedSource,
    recipientRelationName: resolveRecipientRelationName({
      objects,
      sourceObjectName: resolvedSource.objectName,
      relationUid,
    }),
  });

  // REACHABILITY of each object this catalog would read, decided by a bounded
  // query whose FAILURE MODE distinguishes the three outcomes. This is what makes
  // "no records", "not in this request's schema" and "refused" tellable apart —
  // and what stops an empty table from looking like an object with no fields.
  const neededObjects = new Set(
    permitted.variables.map((variable) =>
      // A Company field is read through the Person, so it needs the PERSON target.
      variable.objectName === 'company' ? 'person' : variable.objectName,
    ),
  );

  const recordIdByObjectName = new Map<string, string | null>();
  let sourceReachability: ObjectReachability = OBJECT_REACHABILITY.REACHABLE;

  for (const objectName of neededObjects) {
    const pluralName = objects.find(
      (object) => object.nameSingular === objectName,
    )?.namePlural;

    if (pluralName === undefined) {
      recordIdByObjectName.set(objectName, null);
      continue;
    }

    const reachability = await classifyObjectReachability({
      client,
      objectNamePlural: pluralName,
    });

    if (objectName === resolvedSource.objectName) {
      sourceReachability = reachability.reachability;
    }

    recordIdByObjectName.set(objectName, reachability.recordId);

    // A Company is reached THROUGH a Person that HAS one, so it shares the
    // Person's target. `discoverFieldProbeTargets` finds such a Person because a
    // null relation returns no keys and is not evidence either way. It is guarded
    // because it is a best-effort target search, not a reachability decision: a
    // failure here means Company fields cannot be proven, not that the source is
    // unreachable.
    if (objectName === 'person') {
      try {
        const personTargets = await discoverFieldProbeTargets({ client });
        recordIdByObjectName.set(
          'company',
          personTargets?.companyPersonId ?? null,
        );
      } catch {
        recordIdByObjectName.set('company', null);
      }
    }
  }

  // The SOURCE object itself could not be reached. Reported as the DISTINCT
  // reason rather than as an empty field list.
  if (sourceReachability === OBJECT_REACHABILITY.NOT_IN_SCHEMA) {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.SOURCE_NOT_IN_SCHEMA,
    };
  }

  if (sourceReachability === OBJECT_REACHABILITY.QUERY_REJECTED) {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.SOURCE_QUERY_REJECTED,
    };
  }

  // NO RECORDS is a legitimate state, not a failure: the catalog is returned in
  // full so the user can write the template, and the SAMPLE PICKER is what will
  // report that there is nothing to preview with.
  if (sourceReachability === OBJECT_REACHABILITY.NO_RECORDS) {
    return {
      catalog: permitted,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: true,
      stage: AUTHORIZED_CATALOG_STAGE.OK,
    };
  }

  // The platform's OWN enforcement, observed on a bounded read of a record this
  // caller CAN reach. A field is advertised only if the platform actually
  // returned it.
  //
  // This is the authority on VISIBILITY, and it is deliberately NOT the source of
  // the field LIST: the list comes from metadata above. The probe only ever
  // REMOVES a field metadata already declared.
  try {
    const probe = await probeAuthorizedFieldTokens({
      client,
      catalog: permitted,
      recordIdByObjectName,
    });

    if (probe === null) {
      // Every field was refused on a record we COULD read. That is a permission
      // outcome, and it is distinct from the object being unreachable.
      return {
        catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
        sourceLabelPlural: sourceObject.labelPlural,
        isAvailable: false,
        stage: AUTHORIZED_CATALOG_STAGE.SOURCE_UNAVAILABLE,
      };
    }

    const catalog = restrictCatalogToAuthorizedTokens(
      permitted,
      probe.authorizedTokens,
    );

    // The SOURCE group must survive. Without it the editor would be showing only
    // the recipient's fields for a source the user picked.
    if (
      !catalog.variables.some((variable) => variable.group === 'source')
    ) {
      return {
        catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
        sourceLabelPlural: sourceObject.labelPlural,
        isAvailable: false,
        stage: AUTHORIZED_CATALOG_STAGE.SOURCE_UNAVAILABLE,
      };
    }

    return {
      catalog,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: true,
      stage: AUTHORIZED_CATALOG_STAGE.OK,
    };
  } catch {
    return {
      catalog: EMPTY_TEMPLATE_VARIABLE_CATALOG,
      sourceLabelPlural: sourceObject.labelPlural,
      isAvailable: false,
      stage: AUTHORIZED_CATALOG_STAGE.READ_PROBE_ERROR,
    };
  }
};
