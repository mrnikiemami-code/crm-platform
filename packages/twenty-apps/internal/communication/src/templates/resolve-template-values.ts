import { type CoreApiClient } from 'twenty-client-sdk/core';

import { extractTemplateValue } from 'src/templates/extract-template-value';
import {
  type TemplateValueMap,
  type TemplateVariableCatalog,
  type TemplateVariableDefinition,
} from 'src/templates/template-variable-catalog';

// Reads the authorized values for one recipient's tokens.
//
// The record read is built ONLY from the catalog's `fieldName`s, which came from
// the workspace's own metadata: the selection below is assembled by iterating
// the catalog, never by interpolating anything a client sent. A token that is
// not in the catalog never reaches this code (the engine reports it as unknown
// before any read), so client text can never influence a field selection.
const readRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * The record a template's `source.*` tokens read from.
 *
 * Resolved server-side from the template's own stored/eligible source BEFORE any
 * read, so this is not client input. `objectName` is a real metadata
 * `nameSingular`, and it is the ONLY thing used to choose the root field.
 */
export type TemplateSourceRecord = {
  objectName: string;
  recordId: string;
};

/** The GraphQL selection for one object, keyed by its metadata field names. */
export const buildObjectSelection = (
  definitions: readonly TemplateVariableDefinition[],
): Record<string, unknown> => {
  const selection: Record<string, unknown> = {};

  for (const definition of definitions) {
    selection[definition.fieldName] =
      definition.kind === 'FULL_NAME'
        ? { firstName: true, lastName: true }
        : true;
  }

  return selection;
};

const definitionsForObject = (
  catalog: TemplateVariableCatalog,
  objectName: string,
): TemplateVariableDefinition[] =>
  catalog.variables.filter((variable) => variable.objectName === objectName);

const extractValues = ({
  definitions,
  nodeByObjectName,
  companyNode,
}: {
  definitions: readonly TemplateVariableDefinition[];
  /**
   * The record read for each object the catalog references, keyed by the
   * definition's own `objectName`. Company is absent here and passed separately,
   * because it is read nested under the recipient Person.
   */
  nodeByObjectName: ReadonlyMap<string, Record<string, unknown>>;
  companyNode: Record<string, unknown> | null;
}): TemplateValueMap => {
  const values = new Map<string, string | null>();

  for (const definition of definitions) {
    const source =
      definition.objectName === 'company'
        ? companyNode
        : (nodeByObjectName.get(definition.objectName) ?? null);

    values.set(
      definition.token,
      source === null || source === undefined
        ? null
        : extractTemplateValue({
            kind: definition.kind,
            ...(definition.subFieldName === undefined
              ? {}
              : { subFieldName: definition.subFieldName }),
            rawValue: source[definition.fieldName],
          }),
    );
  }

  return values;
};

export type ResolvedTemplateValues = {
  /** Values per canonical token, or `null` when empty/unreadable. */
  values: TemplateValueMap;
  /** False when the Person does not exist or may not be read. */
  isAccessible: boolean;
  /**
   * False when the SOURCE record could not be read (removed, or no longer
   * permitted). Distinguishes "the source is gone" from "the source's fields are
   * empty", so a preview can report the real cause instead of rendering blanks.
   */
  isSourceAccessible: boolean;
};

/**
 * Resolves one Person's template values. Returns `isAccessible: false` when the
 * platform did not return the record (missing or not permitted), which the
 * caller reports explicitly instead of treating it as "all fields empty".
 */
export const resolveTemplateValues = async ({
  client,
  personId,
  sourceRecord,
  catalog,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personId: string;
  /**
   * The SOURCE record the `source.*` tokens read from, or `null` for a Person
   * source (where the source record IS the recipient, so `person.*` already
   * carries it and a second, identical read would be pure waste).
   */
  sourceRecord: TemplateSourceRecord | null;
  catalog: TemplateVariableCatalog;
}): Promise<ResolvedTemplateValues> => {
  const personDefinitions = definitionsForObject(catalog, 'person');
  const companyDefinitions = definitionsForObject(catalog, 'company');

  const companySelection = buildObjectSelection(companyDefinitions);
  const hasCompanySelection = Object.keys(companySelection).length > 0;

  const result = await client.query({
    person: {
      __args: { filter: { id: { eq: personId } } },
      ...buildObjectSelection(personDefinitions),
      ...(hasCompanySelection ? { company: companySelection } : {}),
    },
  });

  const node = readRecord(result.person);

  if (node === null) {
    return {
      values: new Map<string, string | null>(),
      isAccessible: false,
      isSourceAccessible: false,
    };
  }

  const nodeByObjectName = new Map<string, Record<string, unknown>>([
    ['person', node],
  ]);

  let sourceReadSucceeded = true;

  if (sourceRecord !== null && sourceRecord.objectName !== 'person') {
    // The source record's OWN fields. The selection is built from the catalog's
    // metadata field names for that object, and the root field is the
    // server-resolved `nameSingular` — never anything the client sent.
    const sourceSelection = buildObjectSelection(
      definitionsForObject(catalog, sourceRecord.objectName),
    );

    if (Object.keys(sourceSelection).length > 0) {
      const sourceResult = await client.query({
        [sourceRecord.objectName]: {
          __args: { filter: { id: { eq: sourceRecord.recordId } } },
          ...sourceSelection,
        },
      });

      const sourceNode = readRecord(sourceResult[sourceRecord.objectName]);

      if (sourceNode === null) {
        // The source record is gone or no longer readable. Its tokens resolve to
        // null rather than silently borrowing the recipient's values.
        sourceReadSucceeded = false;
      } else {
        nodeByObjectName.set(sourceRecord.objectName, sourceNode);
      }
    }
  }

  return {
    values: extractValues({
      definitions: catalog.variables,
      nodeByObjectName,
      companyNode: hasCompanySelection ? readRecord(node.company) : null,
    }),
    isAccessible: true,
    isSourceAccessible: sourceReadSucceeded,
  };
};

/**
 * Resolves template values for MANY people in one read (bulk preview/send).
 * A person the platform did not return is simply absent from the map; the bulk
 * resolver already reports that id as NOT_ACCESSIBLE.
 */
export const resolveTemplateValuesForPersons = async ({
  client,
  personIds,
  catalog,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personIds: readonly string[];
  catalog: TemplateVariableCatalog;
}): Promise<Map<string, TemplateValueMap>> => {
  const uniquePersonIds = [...new Set(personIds.filter((id) => id.length > 0))];

  if (uniquePersonIds.length === 0) {
    return new Map();
  }

  const personDefinitions = definitionsForObject(catalog, 'person');
  const companyDefinitions = definitionsForObject(catalog, 'company');

  const companySelection = buildObjectSelection(companyDefinitions);
  const hasCompanySelection = Object.keys(companySelection).length > 0;

  const result = await client.query({
    people: {
      __args: {
        filter: { id: { in: uniquePersonIds } },
        first: uniquePersonIds.length,
      },
      edges: {
        node: {
          id: true,
          ...buildObjectSelection(personDefinitions),
          ...(hasCompanySelection ? { company: companySelection } : {}),
        },
      },
    },
  });

  const valuesByPersonId = new Map<string, TemplateValueMap>();

  for (const edge of result.people?.edges ?? []) {
    const node = readRecord(edge?.node);

    if (node === null || typeof node.id !== 'string') {
      continue;
    }

    valuesByPersonId.set(
      node.id,
      extractValues({
        definitions: catalog.variables,
        nodeByObjectName: new Map([['person', node]]),
        companyNode: hasCompanySelection ? readRecord(node.company) : null,
      }),
    );
  }

  return valuesByPersonId;
};
