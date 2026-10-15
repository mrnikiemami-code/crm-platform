import { type CoreApiClient } from 'twenty-client-sdk/core';

import { buildTemplateFieldSelection } from 'src/templates/extract-template-value';
import {
  buildTemplateVariableCatalog,
  type TemplateVariableCatalog,
  type TemplateVariableDefinition,
} from 'src/templates/template-variable-catalog';

// Authorizes template fields by the platform's OWN record read.
//
// An app-scoped token cannot read workspace role metadata on this platform build
// (every `getRoles` / application-role query is denied — verified live on
// main/4D), so role metadata cannot be the source of truth for field access. The
// platform DOES enforce access on the real record read, and that enforcement is
// observable: a field the caller may read comes back with a value OR `null`,
// while a field the caller may NOT read is absent from the response entirely.
//
// Each field is therefore proven INDIVIDUALLY: one bounded read that selects only
// that field. Nothing is authorized by association — a Company field is never
// accepted because its Person was readable, and vice versa.
export const FIELD_PROBE_CONCURRENCY = 4;

/** How many People the target-discovery read may inspect. */
export const FIELD_PROBE_DISCOVERY_PAGE_SIZE = 25;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Runs `worker` over `items` with at most `concurrency` calls in flight. */
export const mapWithBoundedConcurrency = async <Item, Result>({
  items,
  concurrency,
  worker,
}: {
  items: readonly Item[];
  concurrency: number;
  worker: (item: Item) => Promise<Result>;
}): Promise<Result[]> => {
  const results: Result[] = new Array(items.length);

  if (items.length === 0) {
    return results;
  }

  const limit = Math.max(1, Math.min(Math.trunc(concurrency), items.length));
  let nextIndex = 0;

  const run = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;

      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: limit }, () => run()),
  );

  return results;
};

/** The selection for one definition's field. */
const selectionFor = (definition: TemplateVariableDefinition): unknown =>
  buildTemplateFieldSelection(definition.kind);

/** The dedupe key for a field: two definitions may share one metadata field. */
export const templateFieldKey = (
  definition: Pick<TemplateVariableDefinition, 'objectName' | 'fieldName'>,
): string => `${definition.objectName}:${definition.fieldName}`;

export type FieldProbeTargets = {
  /** An accessible Person id, used for Person-field probes. */
  personId: string;
  /** An accessible Person that HAS a Company, or `null` when none was found. */
  companyPersonId: string | null;
};

/**
 * Finds the People the per-field probes will read. Returns `null` when NO Person
 * is readable at all, which the caller reports as an unavailable catalog.
 *
 * The company target must be a Person that actually has a Company: a null
 * relation would return no field keys, which is not evidence either way, so a
 * Company field can only be proven on a record that has one.
 */
export const discoverFieldProbeTargets = async ({
  client,
  pageSize = FIELD_PROBE_DISCOVERY_PAGE_SIZE,
}: {
  client: Pick<CoreApiClient, 'query'>;
  pageSize?: number;
}): Promise<FieldProbeTargets | null> => {
  const result = (await client.query({
    people: {
      __args: { first: pageSize, orderBy: [{ createdAt: 'DescNullsLast' }] },
      edges: { node: { id: true, company: { id: true } } },
    },
  })) as { people?: { edges?: { node?: unknown }[] } | null };

  const nodes = (result.people?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(isRecord);

  const personId = nodes
    .map((node) => node.id)
    .find((id): id is string => typeof id === 'string' && id.length > 0);

  if (personId === undefined) {
    return null;
  }

  // Any non-null Company relation means this Person HAS a Company, which is all
  // the probes need: they read through the Person, so the Company's own id is
  // never required.
  const companyPerson = nodes.find((node) => isRecord(node.company));
  const companyPersonId =
    companyPerson !== undefined && typeof companyPerson.id === 'string'
      ? companyPerson.id
      : null;

  return { personId, companyPersonId };
};

type ProbeOutcome = 'AUTHORIZED' | 'NOT_AUTHORIZED';

/**
 * Finds ONE accessible record id of an arbitrary object, so its fields can be
 * probed. Returns `null` when the workspace has no readable record of that
 * object — in which case none of its fields can be proven, and they are simply
 * not authorized.
 */
export const discoverRecordIdForObject = async ({
  client,
  objectNamePlural,
}: {
  client: Pick<CoreApiClient, 'query'>;
  objectNamePlural: string;
}): Promise<string | null> => {
  try {
    const result = (await client.query({
      [objectNamePlural]: {
        __args: { first: 1 },
        edges: { node: { id: true } },
      },
    })) as Record<string, unknown>;

    const connection = isRecord(result[objectNamePlural])
      ? (result[objectNamePlural] as Record<string, unknown>)
      : null;
    const edges = Array.isArray(connection?.edges) ? connection.edges : [];

    for (const edge of edges) {
      const node = isRecord(edge) ? (edge.node as unknown) : null;

      if (isRecord(node) && typeof node.id === 'string' && node.id.length > 0) {
        return node.id;
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Probes ONE field through a bounded read of a real record.
 *
 * The read is built from the object's own `nameSingular` and the definition's
 * own `fieldName`, both of which came from server-side metadata. A Company is
 * the exception: it is read THROUGH the Person's relation, because that is how
 * the resolver reads it too.
 */
const probeOneField = async ({
  client,
  objectName,
  recordId,
  definition,
}: {
  client: Pick<CoreApiClient, 'query'>;
  objectName: string;
  recordId: string;
  definition: TemplateVariableDefinition;
}): Promise<ProbeOutcome> => {
  try {
    // The ROOT field of the read. A Company is not a root object here: it is
    // reached through the Person's `company` relation, which is exactly how the
    // resolver reads it, so both the query and the response are keyed by
    // `person` in that case.
    const rootField = objectName === 'company' ? 'person' : objectName;

    const result = (await client.query(
      objectName === 'company'
        ? {
            person: {
              __args: { filter: { id: { eq: recordId } } },
              id: true,
              company: { [definition.fieldName]: selectionFor(definition) },
            },
          }
        : {
            [objectName]: {
              __args: { filter: { id: { eq: recordId } } },
              id: true,
              [definition.fieldName]: selectionFor(definition),
            },
          },
    )) as Record<string, unknown>;

    const node = isRecord(result[rootField]) ? result[rootField] : null;

    if (node === null) {
      return 'NOT_AUTHORIZED';
    }

    if (objectName === 'company') {
      const company = isRecord((node as Record<string, unknown>).company)
        ? ((node as Record<string, unknown>).company as Record<string, unknown>)
        : null;

      return company !== null && definition.fieldName in company
        ? 'AUTHORIZED'
        : 'NOT_AUTHORIZED';
    }

    return definition.fieldName in (node as Record<string, unknown>)
      ? 'AUTHORIZED'
      : 'NOT_AUTHORIZED';
  } catch {
    // A denied or malformed probe is simply not proof of readability.
    return 'NOT_AUTHORIZED';
  }
};

export type FieldProbeResult = {
  /** The canonical tokens that passed their own bounded read. */
  authorizedTokens: Set<string>;
} | null;

/**
 * Probes every candidate field through its OWN bounded read.
 *
 * Returns `null` when there is no readable Person, or when every probe fails —
 * both of which the caller reports as an EMPTY, unavailable catalog. Fields are
 * deduped by metadata field first, so a FULL_NAME field is read once and its
 * three tokens share the result.
 */
export const probeAuthorizedFieldTokens = async ({
  client,
  catalog,
  objectPluralNames,
  concurrency = FIELD_PROBE_CONCURRENCY,
}: {
  client: Pick<CoreApiClient, 'query'>;
  catalog: TemplateVariableCatalog;
  /**
   * `nameSingular` → `namePlural`, for the objects in the catalog. Needed to
   * reach a source object's records. Person/Company are resolved structurally
   * (Person directly, Company through Person) and do not use it.
   */
  objectPluralNames: ReadonlyMap<string, string>;
  concurrency?: number;
}): Promise<FieldProbeResult> => {
  // One representative definition per metadata field.
  const definitionsByKey = new Map<string, TemplateVariableDefinition>();

  for (const definition of catalog.variables) {
    const key = templateFieldKey(definition);

    if (!definitionsByKey.has(key)) {
      definitionsByKey.set(key, definition);
    }
  }

  const keys = [...definitionsByKey.keys()];

  if (keys.length === 0) {
    return null;
  }

  // The objects this catalog actually needs to read. Only these are discovered,
  // so an unused object costs no extra read.
  const neededObjectNames = new Set(
    [...definitionsByKey.values()].map((definition) =>
      // A Company field is read through the Person, so it needs the PERSON target.
      definition.objectName === 'company' ? 'person' : definition.objectName,
    ),
  );

  // Person discovery also yields the Company target (a Person that HAS a
  // Company), because a Company field can only be proven on a record that has
  // one — a null relation returns no keys and is not evidence either way.
  const personTargets = neededObjectNames.has('person')
    ? await discoverFieldProbeTargets({ client })
    : null;

  const recordIdByObjectName = new Map<string, string | null>();

  for (const objectName of neededObjectNames) {
    if (objectName === 'person') {
      recordIdByObjectName.set('person', personTargets?.personId ?? null);
      recordIdByObjectName.set(
        'company',
        personTargets?.companyPersonId ?? null,
      );
      continue;
    }

    const pluralName = objectPluralNames.get(objectName);

    recordIdByObjectName.set(
      objectName,
      pluralName === undefined
        ? null
        : await discoverRecordIdForObject({
            client,
            objectNamePlural: pluralName,
          }),
    );
  }

  const outcomes = await mapWithBoundedConcurrency({
    items: keys,
    concurrency,
    worker: async (key) => {
      const definition = definitionsByKey.get(key) as TemplateVariableDefinition;
      // A Company field is proven through the Person that HAS a Company, so the
      // target key is `company` (which `discoverFieldProbeTargets` filled with
      // such a Person, or `null` when none was found). Every other field is
      // proven through a record of its OWN object.
      const targetKey =
        definition.objectName === 'company' ? 'company' : definition.objectName;
      const recordId = recordIdByObjectName.get(targetKey);

      if (recordId === null || recordId === undefined) {
        // No readable record to prove the field on, so it is not authorized.
        return 'NOT_AUTHORIZED' as ProbeOutcome;
      }

      return probeOneField({
        client,
        objectName: definition.objectName,
        recordId,
        definition,
      });
    },
  });

  const authorizedKeys = new Set(
    keys.filter((key, index) => outcomes[index] === 'AUTHORIZED'),
  );

  const authorizedTokens = new Set(
    catalog.variables
      .filter((definition) => authorizedKeys.has(templateFieldKey(definition)))
      .map((definition) => definition.token),
  );

  return authorizedTokens.size === 0 ? null : { authorizedTokens };
};

/** Restricts the candidate catalog to the tokens that passed their own read. */
export const restrictCatalogToAuthorizedTokens = (
  catalog: TemplateVariableCatalog,
  authorizedTokens: ReadonlySet<string>,
): TemplateVariableCatalog =>
  buildTemplateVariableCatalog(
    catalog.variables.filter((definition) =>
      authorizedTokens.has(definition.token),
    ),
  );
