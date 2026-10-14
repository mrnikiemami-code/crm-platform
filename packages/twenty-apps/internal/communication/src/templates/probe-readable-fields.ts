import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  buildTemplateVariableCatalog,
  type TemplateVariableCatalog,
  type TemplateVariableDefinition,
} from 'src/templates/template-variable-catalog';

// Authorizes a candidate catalog by the platform's OWN record read.
//
// An app-scoped token cannot read workspace role metadata on this platform build
// (every `getRoles` / application-role query is denied — verified live on
// main/4D), so role metadata cannot be the source of truth for field access. The
// platform DOES enforce access on the real record read, and that enforcement is
// observable:
//
//   - a field this caller may read comes back with a value OR `null`;
//   - a field this caller may NOT read is absent from the response entirely.
//
// So one bounded probe read (`first: 1`) of an accessible Person reports exactly
// which candidate fields are usable, and the catalog is restricted to those.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** The selection for a set of definitions, grouped into person and company. */
const buildProbeSelection = (definitions: readonly TemplateVariableDefinition[]) => {
  const personSelection: Record<string, unknown> = {};
  const companySelection: Record<string, unknown> = {};

  for (const definition of definitions) {
    const selection =
      definition.kind === 'FULL_NAME'
        ? { firstName: true, lastName: true }
        : true;

    if (definition.objectName === 'company') {
      companySelection[definition.fieldName] = selection;
    } else {
      personSelection[definition.fieldName] = selection;
    }
  }

  return { personSelection, companySelection };
};

export type ObservedTemplateFields = {
  /** Field names the read returned on the Person. */
  personFieldNames: Set<string>;
  /** Field names the read returned on the related Company, if it was read. */
  companyFieldNames: Set<string>;
  /** True when a Company was actually returned for the probed Person. */
  hasCompany: boolean;
};

/**
 * Reads ONE accessible Person and reports which candidate fields came back.
 * Returns `null` when no Person is readable at all — the caller treats that as
 * "cannot authorize" and fails closed.
 */
export const probeReadableTemplateFields = async ({
  client,
  catalog,
}: {
  client: Pick<CoreApiClient, 'query'>;
  catalog: TemplateVariableCatalog;
}): Promise<ObservedTemplateFields | null> => {
  const { personSelection, companySelection } = buildProbeSelection(
    catalog.variables,
  );

  const hasCompanySelection = Object.keys(companySelection).length > 0;

  const result = (await client.query({
    people: {
      __args: { first: 1 },
      edges: {
        node: {
          id: true,
          ...personSelection,
          ...(hasCompanySelection ? { company: companySelection } : {}),
        },
      },
    },
  })) as {
    people?: { edges?: { node?: unknown }[] } | null;
  };

  const node = (result.people?.edges ?? [])
    .map((edge) => edge?.node)
    .find((candidate) => isRecord(candidate));

  if (!isRecord(node)) {
    return null;
  }

  const company = isRecord(node.company) ? node.company : null;

  return {
    personFieldNames: new Set(Object.keys(node)),
    companyFieldNames: new Set(company === null ? [] : Object.keys(company)),
    hasCompany: company !== null,
  };
};

/**
 * Restricts the candidate catalog to the fields the probe read authorizes.
 *
 * Two different strengths of evidence, stated honestly:
 *
 *  - PERSON fields are restricted to the keys the read ACTUALLY returned. A
 *    readable-but-empty field comes back as `null` (so the key is present), while
 *    a field the caller may not read is absent — so the returned key set is a
 *    reliable per-field authorization signal.
 *  - COMPANY fields are read through the SAME Person record read
 *    (`person { company { … } }`), so the Company's own object permission is what
 *    the platform enforces. A probed Person that simply has NO company returns a
 *    null relation, which is NOT evidence that company fields are unreadable — so
 *    withholding them would silently break valid templates. They are therefore
 *    kept whenever a Person was readable, and this weaker relation-level
 *    guarantee is recorded rather than overstated.
 */
export const restrictCatalogToObservedFields = (
  catalog: TemplateVariableCatalog,
  observed: ObservedTemplateFields,
): TemplateVariableCatalog =>
  buildTemplateVariableCatalog(
    catalog.variables.filter((definition) =>
      definition.objectName === 'company'
        ? true
        : observed.personFieldNames.has(definition.fieldName),
    ),
  );
