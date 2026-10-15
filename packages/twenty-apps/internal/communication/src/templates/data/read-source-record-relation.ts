import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type EligibleTemplateSource } from 'src/templates/data/find-eligible-template-sources';

// Reads a SOURCE record and follows its stored relation to the one Person it
// resolves to.
//
// Why this exists: for a template whose source is not Person, the recipient is
// not chosen by the client — it is a property of the SELECTED source record. The
// server reads that record's own relation field, so two related records pointing
// at the same Person still preview from the record the user picked, and no
// client-supplied Person can stand in for it.
//
// Every object/field name used here was resolved from live metadata by the
// caller; nothing accepts a table or column name straight from a request.
export type SourceRelationResult =
  | { kind: 'RESOLVED'; personId: string }
  | { kind: 'RELATION_EMPTY' }
  | { kind: 'NOT_FOUND' };

/** A GraphQL selection key must be a plain identifier. */
const SAFE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Shown when a record genuinely has no title. An untitled option is forbidden:
 * a blank row is indistinguishable from a loading bug, so the fallback names the
 * situation instead.
 */
export const UNTITLED_RECORD_LABEL = 'بدون عنوان';

/**
 * How a label-identifier field must be read.
 *
 * A `FULL_NAME` field is a composite (`{ firstName, lastName }`) while a plain
 * text field is a string, so the shape decides both the query selection and how
 * the value is turned into text. Unknown shapes are read as scalars and simply
 * fall back when they are not strings.
 */
export type LabelShape = 'FULL_NAME' | 'SCALAR';

/** Reads the label field's type from the object's own metadata. */
const resolveLabelShape = (source: {
  labelFieldName: string | null;
  labelFieldType?: string | null;
}): LabelShape =>
  source.labelFieldType === 'FULL_NAME' ? 'FULL_NAME' : 'SCALAR';

/**
 * Turns a fetched record into a readable title.
 *
 * Returns the fallback for a missing, empty or unusable value, so the picker can
 * never render a title-less option.
 */
export const readRecordLabel = (
  node: Record<string, unknown>,
  labelFieldName: string | null,
): string => {
  if (labelFieldName === null) {
    return UNTITLED_RECORD_LABEL;
  }

  const raw = node[labelFieldName];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    return trimmed.length > 0 ? trimmed : UNTITLED_RECORD_LABEL;
  }

  if (raw !== null && typeof raw === 'object') {
    const composite = raw as {
      firstName?: unknown;
      lastName?: unknown;
    };

    const parts = [composite.firstName, composite.lastName]
      .filter((part): part is string => typeof part === 'string')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    return parts.length > 0 ? parts.join(' ') : UNTITLED_RECORD_LABEL;
  }

  return UNTITLED_RECORD_LABEL;
};

/**
 * Reads one source record by id and returns the id of the Person its relation
 * points at.
 */
export const readSourceRecordRelation = async ({
  client,
  objectName,
  relationName,
  recordId,
}: {
  client: Pick<CoreApiClient, 'query'>;
  objectName: string;
  relationName: string;
  recordId: string;
}): Promise<SourceRelationResult> => {
  if (
    !SAFE_NAME_PATTERN.test(objectName) ||
    !SAFE_NAME_PATTERN.test(relationName)
  ) {
    // Defence in depth: the caller already validated the pair against metadata.
    return { kind: 'NOT_FOUND' };
  }

  // A singular root field accepts `filter` and is NOT a connection, so it must
  // never be queried with first/edges.
  const result = await client.query({
    [objectName]: {
      __args: { filter: { id: { eq: recordId } } },
      id: true,
      [relationName]: { id: true },
    },
  });

  const node = (result as Record<string, unknown>)[objectName] as
    | Record<string, unknown>
    | null
    | undefined;

  if (node === null || node === undefined) {
    return { kind: 'NOT_FOUND' };
  }

  const relation = node[relationName] as { id?: unknown } | null | undefined;
  const personId =
    relation !== null &&
    relation !== undefined &&
    typeof relation.id === 'string' &&
    relation.id.length > 0
      ? relation.id
      : null;

  // A stored relation that is null on this record is reported as such: the
  // recipient is never guessed and no other record is consulted.
  return personId === null
    ? { kind: 'RELATION_EMPTY' }
    : { kind: 'RESOLVED', personId };
};

/**
 * Searches records of ONE source object by a free-text term, for the sample
 * picker. Bounded, and scoped to the object the template declares.
 *
 * The connection field is the object's `namePlural` from metadata — NOT
 * `nameSingular + 's'`, because Person's is `people`.
 */
export const searchSourceRecords = async ({
  client,
  source,
  search,
  limit = 20,
}: {
  client: Pick<CoreApiClient, 'query'>;
  source: EligibleTemplateSource;
  search: string;
  limit?: number;
}): Promise<{ id: string; label: string }[]> => {
  if (
    !SAFE_NAME_PATTERN.test(source.objectName) ||
    !SAFE_NAME_PATTERN.test(source.objectNamePlural)
  ) {
    return [];
  }

  const term = source.objectName === 'person' ? '' : search.trim();
  const pattern = `%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

  // Search the DECLARED label field when it is a plain scalar text field, so a
  // search matches what the user sees. A composite or absent label field falls
  // back to no filter rather than guessing `name`, which only Person has.
  const labelField = source.labelFieldName;
  const canFilterOnLabel =
    labelField !== null && SAFE_NAME_PATTERN.test(labelField);
  const labelShape = resolveLabelShape(source);

  const nameFilter =
    term.length === 0 || !canFilterOnLabel
      ? undefined
      : labelShape === 'FULL_NAME'
        ? {
            or: [
              { [labelField]: { firstName: { ilike: pattern } } },
              { [labelField]: { lastName: { ilike: pattern } } },
            ],
          }
        : { [labelField]: { ilike: pattern } };

  const nodeSelection =
    labelField === null
      ? { id: true }
      : { id: true, [labelField]: true };

  const result = await client.query({
    [source.objectNamePlural]: {
      __args: {
        first: Math.min(Math.max(limit, 1), 50),
        orderBy: [{ createdAt: 'DescNullsLast' }],
        ...(nameFilter === undefined ? {} : { filter: nameFilter }),
      },
      edges: {
        node: nodeSelection,
      },
    },
  });

  const container = (result as Record<string, unknown>)[
    source.objectNamePlural
  ] as { edges?: { node?: Record<string, unknown> | null }[] } | null | undefined;

  const edges = container?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter(
      (node): node is Record<string, unknown> =>
        node !== null && node !== undefined,
    )
    .map((node) => {
      const id = typeof node.id === 'string' ? node.id : '';

      return { id, label: readRecordLabel(node, labelField) };
    })
    .filter((entry) => entry.id.length > 0);
};
