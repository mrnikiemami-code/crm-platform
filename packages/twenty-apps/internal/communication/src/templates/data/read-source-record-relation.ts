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

type RawNode = {
  id?: unknown;
  name?: { firstName?: string | null; lastName?: string | null } | null;
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

  const nameFilter =
    term.length === 0
      ? undefined
      : {
          or: [
            { name: { firstName: { ilike: pattern } } },
            { name: { lastName: { ilike: pattern } } },
          ],
        };

  const result = await client.query({
    [source.objectNamePlural]: {
      __args: {
        first: Math.min(Math.max(limit, 1), 50),
        orderBy: [{ createdAt: 'DescNullsLast' }],
        ...(nameFilter === undefined ? {} : { filter: nameFilter }),
      },
      edges: {
        node: {
          id: true,
          name: { firstName: true, lastName: true },
        },
      },
    },
  });

  const container = (result as Record<string, unknown>)[
    source.objectNamePlural
  ] as { edges?: { node?: RawNode | null }[] } | null | undefined;

  const edges = container?.edges ?? [];

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is RawNode => node !== null && node !== undefined)
    .map((node) => {
      const parts = [
        node.name?.firstName?.trim() ?? '',
        node.name?.lastName?.trim() ?? '',
      ].filter((part) => part.length > 0);

      const id = typeof node.id === 'string' ? node.id : '';

      return { id, label: parts.join(' ') };
    })
    .filter((entry) => entry.id.length > 0);
};
