import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

// Discovers the source objects a template may be written for, from the
// workspace's OWN metadata, and resolves stored identifiers back to API names.
//
// The product rule: the final SMS recipient is always a Person, and a template's
// source is either a Person itself or another object whose selected record
// resolves to exactly ONE Person. "Exactly one" is judged from the source
// record, so only the SINGULAR side of a relation qualifies; a collection is
// excluded because one source record would then map to several recipients.
//
// IDENTITY: what is stored is the metadata `universalIdentifier` of the object
// and of the relation field, never a name. Names are labels an operator can
// rename, so they are resolved from metadata on every use instead of being
// treated as identity. The resolution is total-or-explicit: an identifier that
// no longer resolves is reported as unresolvable, NEVER silently turned into
// Person.
export const PERSON_SOURCE_OBJECT_NAME = 'person';

/** One relation on a source object that resolves to a single Person. */
export type EligibleSourceRelation = {
  /** Stable relation-field identifier — the value that gets stored. */
  relationUid: string;
  /** API field name, resolved from metadata for querying. */
  relationName: string;
  /** Workspace-facing label. */
  relationLabel: string;
};

/** One object a template may be sourced from. */
export type EligibleTemplateSource = {
  /** Stable object identifier — the value that gets stored. */
  objectUid: string;
  /** API `nameSingular`, resolved from metadata for the singular root field. */
  objectName: string;
  /**
   * API `namePlural`, resolved from metadata for the connection field. The
   * connection name is NOT `nameSingular + 's'` (Person's is `people`), so it is
   * carried explicitly rather than derived.
   */
  objectNamePlural: string;
  labelSingular: string;
  labelPlural: string;
  /**
   * The object's OWN label-identifier field name, resolved from metadata.
   *
   * Sample titles are read from this field — never from an assumed
   * `name.firstName/lastName`, which only Person happens to have. `null` when
   * metadata declares no label field.
   */
  labelFieldName: string | null;
  /**
   * The label field's metadata TYPE. A `FULL_NAME` field is a composite, so the
   * reader needs to know how to turn it into text.
   */
  labelFieldType: string | null;
  /**
   * Relations that can resolve the recipient. A Person source has none (the
   * record IS the person); any other source has at least one.
   */
  relations: EligibleSourceRelation[];
};

type RawRelation = {
  type?: string | null;
  targetObjectMetadata?: {
    id?: string | null;
    universalIdentifier?: string | null;
  } | null;
};

type RawField = {
  id?: string | null;
  universalIdentifier?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  relation?: RawRelation | null;
};

type RawObject = {
  id?: string | null;
  universalIdentifier?: string | null;
  nameSingular?: string | null;
  namePlural?: string | null;
  labelIdentifierFieldMetadataId?: string | null;
  labelSingular?: string | null;
  labelPlural?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  fieldsList?: RawField[] | null;
};

export const ELIGIBLE_SOURCES_QUERY = {
  objects: {
    __args: { paging: { first: 200 }, filter: {} },
    edges: {
      node: {
        id: true,
        universalIdentifier: true,
        nameSingular: true,
        namePlural: true,
        labelIdentifierFieldMetadataId: true,
        labelSingular: true,
        labelPlural: true,
        isActive: true,
        isSystem: true,
        fieldsList: {
          id: true,
          universalIdentifier: true,
          name: true,
          label: true,
          type: true,
          isActive: true,
          isSystem: true,
          relation: {
            type: true,
            targetObjectMetadata: { id: true, universalIdentifier: true },
          },
        },
      },
    },
  },
} as const;

const isNonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Builds the eligible-source list from metadata. PURE, so the selection rules
 * are testable without a workspace.
 *
 * Person is always first and always eligible: it needs no relation, because the
 * selected Person record IS the recipient.
 */
export const buildEligibleTemplateSources = (
  objects: readonly unknown[],
): EligibleTemplateSource[] => {
  const parsed = objects.filter(
    (object): object is RawObject => object !== null && typeof object === 'object',
  );

  const person = parsed.find(
    (object) => object.nameSingular === PERSON_SOURCE_OBJECT_NAME,
  );

  if (
    person === undefined ||
    !isNonEmpty(person.universalIdentifier) ||
    person.isActive === false
  ) {
    // Without a resolvable Person object there is no valid source at all, so the
    // list is EMPTY rather than guessed.
    return [];
  }

  const personUid = person.universalIdentifier;

  // The label field is whatever metadata declares as the object's identifier —
  // never an assumed `name`. Read once per object and reused.
  const resolveLabelFieldName = (object: RawObject): string | null => {
    const labelFieldId = object.labelIdentifierFieldMetadataId;

    if (!isNonEmpty(labelFieldId)) {
      return null;
    }

    const field = (object.fieldsList ?? []).find(
      (candidate) => candidate.id === labelFieldId,
    );

    return field !== undefined && isNonEmpty(field.name) ? field.name : null;
  };

  const resolveLabelFieldType = (object: RawObject): string | null => {
    const labelFieldId = object.labelIdentifierFieldMetadataId;

    if (!isNonEmpty(labelFieldId)) {
      return null;
    }

    const field = (object.fieldsList ?? []).find(
      (candidate) => candidate.id === labelFieldId,
    );

    return field !== undefined && isNonEmpty(field.type) ? field.type : null;
  };

  const sources: EligibleTemplateSource[] = [
    {
      objectUid: personUid,
      objectName: PERSON_SOURCE_OBJECT_NAME,
      objectNamePlural: person.namePlural ?? PERSON_SOURCE_OBJECT_NAME,
      labelSingular: person.labelSingular ?? PERSON_SOURCE_OBJECT_NAME,
      labelPlural: person.labelPlural ?? PERSON_SOURCE_OBJECT_NAME,
      labelFieldName: resolveLabelFieldName(person),
      labelFieldType: resolveLabelFieldType(person),
      relations: [],
    },
  ];

  for (const object of parsed) {
    if (
      !isNonEmpty(object.universalIdentifier) ||
      !isNonEmpty(object.nameSingular) ||
      object.nameSingular === PERSON_SOURCE_OBJECT_NAME ||
      object.isActive === false ||
      object.isSystem === true
    ) {
      continue;
    }

    const relations: EligibleSourceRelation[] = [];

    for (const field of object.fieldsList ?? []) {
      if (
        field.type !== 'RELATION' ||
        field.isActive === false ||
        field.isSystem === true ||
        !isNonEmpty(field.name) ||
        !isNonEmpty(field.universalIdentifier)
      ) {
        continue;
      }

      const relation = field.relation;

      if (relation == null || relation.type !== 'MANY_TO_ONE') {
        // ONE_TO_MANY is a collection of Persons: one source record would map to
        // several recipients, so it is never offered.
        continue;
      }

      if (relation.targetObjectMetadata?.universalIdentifier !== personUid) {
        continue;
      }

      relations.push({
        relationUid: field.universalIdentifier,
        relationName: field.name,
        relationLabel: isNonEmpty(field.label) ? field.label : field.name,
      });
    }

    if (relations.length === 0) {
      continue;
    }

    sources.push({
      objectUid: object.universalIdentifier,
      objectName: object.nameSingular,
      objectNamePlural: isNonEmpty(object.namePlural)
        ? object.namePlural
        : object.nameSingular,
      labelSingular: object.labelSingular ?? object.nameSingular,
      labelPlural: object.labelPlural ?? object.nameSingular,
      labelFieldName: resolveLabelFieldName(object),
      labelFieldType: resolveLabelFieldType(object),
      relations,
    });
  }

  return sources;
};

/** Reads the workspace metadata and returns the eligible sources. */
export const findEligibleTemplateSources = async ({
  metadataClient,
}: {
  metadataClient: Pick<MetadataApiClient, 'query'>;
}): Promise<EligibleTemplateSource[]> => {
  const result = await metadataClient.query(ELIGIBLE_SOURCES_QUERY);

  return buildEligibleTemplateSources(
    (result.objects?.edges ?? []).map((edge) => edge?.node as unknown),
  );
};

/**
 * The outcome of resolving a template's stored source.
 *
 * `LEGACY_PERSON` is a DIFFERENT outcome from `RESOLVED`, and that distinction is
 * the point: a row that stores no identifier at all predates the source model and
 * means Person, while a row that stores an identifier which no longer resolves is
 * broken. Collapsing the second case into the first would silently send a
 * template written for another object as if it were a Person template.
 */
export type ResolvedTemplateSource =
  | { kind: 'LEGACY_PERSON'; objectName: string; objectUid: string | null }
  | {
      kind: 'RESOLVED';
      objectName: string;
      objectUid: string;
      /** Empty when the source record IS the person. */
      relationUid: string;
      relationName: string;
    }
  | { kind: 'UNRESOLVABLE' };

/**
 * Resolves a template's stored identifiers against the live eligible set.
 *
 * Returns `UNRESOLVABLE` — never Person — when an identifier is present but the
 * object or relation no longer qualifies (renamed away, deactivated, turned into
 * a collection, or removed).
 */
export const resolveStoredTemplateSource = ({
  sources,
  storedObjectUid,
  storedRelationUid,
}: {
  sources: readonly EligibleTemplateSource[];
  storedObjectUid: string;
  storedRelationUid: string;
}): ResolvedTemplateSource => {
  const hasObject = storedObjectUid.length > 0;
  const hasRelation = storedRelationUid.length > 0;

  if (!hasObject) {
    // No stored source at all: the legacy meaning is Person. A relation WITHOUT
    // an object is broken data, not a legacy row.
    return hasRelation
      ? { kind: 'UNRESOLVABLE' }
      : {
          kind: 'LEGACY_PERSON',
          objectName: PERSON_SOURCE_OBJECT_NAME,
          objectUid: null,
        };
  }

  const source = sources.find((entry) => entry.objectUid === storedObjectUid);

  if (source === undefined) {
    return { kind: 'UNRESOLVABLE' };
  }

  if (source.objectName === PERSON_SOURCE_OBJECT_NAME) {
    return hasRelation
      ? // A Person source cannot carry a relation; that pairing is broken data.
        { kind: 'UNRESOLVABLE' }
      : {
          kind: 'RESOLVED',
          objectName: source.objectName,
          objectUid: source.objectUid,
          relationUid: '',
          relationName: '',
        };
  }

  if (!hasRelation) {
    // A related source MUST name its relation; guessing one would be exactly the
    // "pick a Person for the user" failure this model exists to prevent.
    return { kind: 'UNRESOLVABLE' };
  }

  const relation = source.relations.find(
    (entry) => entry.relationUid === storedRelationUid,
  );

  if (relation === undefined) {
    return { kind: 'UNRESOLVABLE' };
  }

  return {
    kind: 'RESOLVED',
    objectName: source.objectName,
    objectUid: source.objectUid,
    relationUid: relation.relationUid,
    relationName: relation.relationName,
  };
};

/**
 * Validates a requested (object, relation) pair against the eligible set, for
 * WRITES.
 *
 * Returns the canonical stored pair, or `null` when the request is not eligible —
 * so a forged or stale client value is rejected instead of being stored. An empty
 * relation is only valid for Person.
 */
export const resolveEligibleSource = ({
  sources,
  objectUid,
  relationUid,
}: {
  sources: readonly EligibleTemplateSource[];
  objectUid: string;
  relationUid: string;
}): { objectUid: string; relationUid: string } | null => {
  const source = sources.find((entry) => entry.objectUid === objectUid);

  if (source === undefined) {
    return null;
  }

  if (source.objectName === PERSON_SOURCE_OBJECT_NAME) {
    return { objectUid, relationUid: '' };
  }

  const relation = source.relations.find(
    (entry) => entry.relationUid === relationUid,
  );

  return relation === undefined
    ? null
    : { objectUid, relationUid: relation.relationUid };
};
