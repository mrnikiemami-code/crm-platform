import { type CoreApiClient } from 'twenty-client-sdk/core';

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
  definition.kind === 'FULL_NAME'
    ? { firstName: true, lastName: true }
    : true;

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

const probeOneField = async ({
  client,
  personId,
  definition,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personId: string;
  definition: TemplateVariableDefinition;
}): Promise<ProbeOutcome> => {
  try {
    const result = (await client.query(
      definition.objectName === 'company'
        ? {
            person: {
              __args: { filter: { id: { eq: personId } } },
              id: true,
              company: { [definition.fieldName]: selectionFor(definition) },
            },
          }
        : {
            person: {
              __args: { filter: { id: { eq: personId } } },
              id: true,
              [definition.fieldName]: selectionFor(definition),
            },
          },
    )) as { person?: unknown };

    const node = isRecord(result.person) ? result.person : null;

    if (node === null) {
      return 'NOT_AUTHORIZED';
    }

    if (definition.objectName === 'company') {
      const company = isRecord(node.company) ? node.company : null;

      return company !== null && definition.fieldName in company
        ? 'AUTHORIZED'
        : 'NOT_AUTHORIZED';
    }

    return definition.fieldName in node ? 'AUTHORIZED' : 'NOT_AUTHORIZED';
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
  concurrency = FIELD_PROBE_CONCURRENCY,
}: {
  client: Pick<CoreApiClient, 'query'>;
  catalog: TemplateVariableCatalog;
  concurrency?: number;
}): Promise<FieldProbeResult> => {
  const targets = await discoverFieldProbeTargets({ client });

  if (targets === null) {
    return null;
  }

  // One representative definition per metadata field.
  const definitionsByKey = new Map<string, TemplateVariableDefinition>();

  for (const definition of catalog.variables) {
    const key = templateFieldKey(definition);

    if (!definitionsByKey.has(key)) {
      definitionsByKey.set(key, definition);
    }
  }

  const keys = [...definitionsByKey.keys()];

  const outcomes = await mapWithBoundedConcurrency({
    items: keys,
    concurrency,
    worker: (key) => {
      const definition = definitionsByKey.get(key) as TemplateVariableDefinition;
      const personId =
        definition.objectName === 'company'
          ? targets.companyPersonId
          : targets.personId;

      // Without a Person that has a Company, a Company field cannot be proven,
      // so it is not authorized.
      return personId === null
        ? Promise.resolve<ProbeOutcome>('NOT_AUTHORIZED')
        : probeOneField({ client, personId, definition });
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
