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
  objectName: 'person' | 'company',
): TemplateVariableDefinition[] =>
  catalog.variables.filter((variable) => variable.objectName === objectName);

const extractValues = ({
  definitions,
  personNode,
  companyNode,
}: {
  definitions: readonly TemplateVariableDefinition[];
  personNode: Record<string, unknown>;
  companyNode: Record<string, unknown> | null;
}): TemplateValueMap => {
  const values = new Map<string, string | null>();

  for (const definition of definitions) {
    const source = definition.objectName === 'person' ? personNode : companyNode;

    values.set(
      definition.token,
      source === null
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
};

/**
 * Resolves one Person's template values. Returns `isAccessible: false` when the
 * platform did not return the record (missing or not permitted), which the
 * caller reports explicitly instead of treating it as "all fields empty".
 */
export const resolveTemplateValues = async ({
  client,
  personId,
  catalog,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personId: string;
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
    return { values: new Map<string, string | null>(), isAccessible: false };
  }

  return {
    values: extractValues({
      definitions: catalog.variables,
      personNode: node,
      companyNode: hasCompanySelection ? readRecord(node.company) : null,
    }),
    isAccessible: true,
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
        personNode: node,
        companyNode: hasCompanySelection ? readRecord(node.company) : null,
      }),
    );
  }

  return valuesByPersonId;
};
