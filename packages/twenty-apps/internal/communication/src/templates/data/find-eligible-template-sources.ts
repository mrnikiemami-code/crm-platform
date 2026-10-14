import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

// Discovers the source objects a template may be written for, from the
// workspace's OWN metadata.
//
// The product rule: the final SMS recipient is always a Person, and a template's
// source is either a Person itself or another object whose selected record
// resolves to exactly ONE Person. "Exactly one" is judged from the source
// record, so only the SINGULAR side of a relation qualifies; a collection of
// Persons is excluded, because one source record would then map to several
// recipients and any value read from it would be ambiguous.
//
// In this platform's metadata a MANY_TO_ONE relation field ON the source object
// pointing AT Person is exactly that singular side (a stored one-to-one is the
// same shape with `isUnique`). A ONE_TO_MANY field on the source object pointing
// at Person is a collection and is never offered.
//
// A source is offered only when BOTH the object and the relation field are
// active and non-system. System objects (join tables such as
// `calendarEventParticipant`) are excluded: a user does not author templates for
// them.
export const PERSON_SOURCE_OBJECT_NAME = 'person';

/** One relation on a source object that resolves to a single Person. */
export type EligibleSourceRelation = {
  /** The relation field's name on the source object — the stored identifier. */
  relationName: string;
  /** Workspace-facing label of that field. */
  relationLabel: string;
};

/** One object a template may be sourced from. */
export type EligibleTemplateSource = {
  /** The source object's `nameSingular` — the stored identifier. */
  objectName: string;
  /** Workspace-facing singular/plural labels. */
  labelSingular: string;
  labelPlural: string;
  /**
   * The relations that can resolve the recipient. A Person source has none
   * (the record IS the person); any other source has at least one.
   */
  relations: EligibleSourceRelation[];
};

type RawRelation = {
  type?: string | null;
  targetObjectMetadata?: { id?: string | null; nameSingular?: string | null } | null;
};

type RawField = {
  id?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  relation?: RawRelation | null;
};

type RawObject = {
  id?: string | null;
  nameSingular?: string | null;
  labelSingular?: string | null;
  labelPlural?: string | null;
  isActive?: boolean | null;
  isSystem?: boolean | null;
  fieldsList?: RawField[] | null;
};

const ELIGIBLE_SOURCES_QUERY = {
  objects: {
    __args: { paging: { first: 200 }, filter: {} },
    edges: {
      node: {
        id: true,
        nameSingular: true,
        labelSingular: true,
        labelPlural: true,
        isActive: true,
        isSystem: true,
        fieldsList: {
          id: true,
          name: true,
          label: true,
          type: true,
          isActive: true,
          isSystem: true,
          relation: {
            type: true,
            targetObjectMetadata: { id: true, nameSingular: true },
          },
        },
      },
    },
  },
} as const;

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
    (object): object is RawObject =>
      object !== null && typeof object === 'object',
  );

  const person = parsed.find(
    (object) => object.nameSingular === PERSON_SOURCE_OBJECT_NAME,
  );

  if (person === undefined || person.id == null || person.isActive === false) {
    // Without a readable Person object there is no valid source at all, so the
    // list is EMPTY rather than guessed.
    return [];
  }

  const sources: EligibleTemplateSource[] = [
    {
      objectName: PERSON_SOURCE_OBJECT_NAME,
      labelSingular: person.labelSingular ?? PERSON_SOURCE_OBJECT_NAME,
      labelPlural: person.labelPlural ?? PERSON_SOURCE_OBJECT_NAME,
      relations: [],
    },
  ];

  for (const object of parsed) {
    if (
      object.nameSingular == null ||
      object.nameSingular === PERSON_SOURCE_OBJECT_NAME ||
      object.isActive === false ||
      object.isSystem === true ||
      object.id == null
    ) {
      continue;
    }

    const relations: EligibleSourceRelation[] = [];

    for (const field of object.fieldsList ?? []) {
      if (
        field.type !== 'RELATION' ||
        field.isActive === false ||
        field.isSystem === true ||
        typeof field.name !== 'string' ||
        field.name.length === 0
      ) {
        continue;
      }

      const relation = field.relation;

      if (relation == null || relation.type !== 'MANY_TO_ONE') {
        // ONE_TO_MANY is a collection of Persons: one source record would map to
        // several recipients, so it is never offered.
        continue;
      }

      if (relation.targetObjectMetadata?.id !== person.id) {
        continue;
      }

      relations.push({
        relationName: field.name,
        relationLabel:
          typeof field.label === 'string' && field.label.length > 0
            ? field.label
            : field.name,
      });
    }

    if (relations.length === 0) {
      continue;
    }

    sources.push({
      objectName: object.nameSingular,
      labelSingular: object.labelSingular ?? object.nameSingular,
      labelPlural: object.labelPlural ?? object.nameSingular,
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

  const nodes = (result.objects?.edges ?? []).map(
    (edge) => edge?.node as unknown,
  );

  return buildEligibleTemplateSources(nodes);
};

/**
 * Validates a requested (source object, relation) pair against the eligible set.
 *
 * Returns the CANONICAL pair, or `null` when the request is not eligible — so a
 * forged or stale client value is rejected server-side instead of being stored.
 * An empty relation is only valid for Person.
 */
export const resolveEligibleSource = ({
  sources,
  objectName,
  relationName,
}: {
  sources: readonly EligibleTemplateSource[];
  objectName: string;
  relationName: string;
}): { objectName: string; relationName: string } | null => {
  const source = sources.find((entry) => entry.objectName === objectName);

  if (source === undefined) {
    return null;
  }

  if (objectName === PERSON_SOURCE_OBJECT_NAME) {
    return { objectName, relationName: '' };
  }

  const relation = source.relations.find(
    (entry) => entry.relationName === relationName,
  );

  if (relation === undefined) {
    return null;
  }

  return { objectName, relationName: relation.relationName };
};
