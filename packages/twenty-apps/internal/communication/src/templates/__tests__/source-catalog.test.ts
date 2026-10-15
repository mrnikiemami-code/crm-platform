import { describe, expect, it } from 'vitest';

import {
  buildAuthorizedTemplateCatalog,
  buildTemplateCatalogFromMetadata,
} from 'src/templates/build-template-catalog';
import {
  listTemplateVariableGroups,
  findTemplateVariable,
} from 'src/templates/template-variable-catalog';
import { resolveTemplateValues } from 'src/templates/resolve-template-values';
import {
  OPPORTUNITY_CATALOG_SOURCE,
  PERSON_CATALOG_SOURCE,
  createFakeMetadataClient,
  templateMetadataObjects,
  unrestrictedPermissions,
} from 'src/templates/__tests__/catalog-fixture';

// The catalog is built for the template's SELECTED source.
//
// These are the regression tests for the reported defect: selecting another
// entity kept showing Person variables, because the catalog was built from a
// hard-coded Person+Company pair and never saw the source at all.

const buildFor = (objectName: string) =>
  buildTemplateCatalogFromMetadata({
    objects: templateMetadataObjects,
    permissions: unrestrictedPermissions,
    source: { objectName },
  });

const tokensOf = (objectName: string) =>
  buildFor(objectName).variables.map((variable) => variable.token);

describe('a Person source', () => {
  it('keeps the person fields namespaced to `person` and adds NO source tokens', () => {
    const tokens = tokensOf('person');

    expect(tokens).toContain('person.firstName');
    expect(tokens).toContain('person.jobTitle');
    // Duplication guard: a Person source IS the record, so there is no second,
    // identical `source.*` listing of the same fields.
    expect(tokens.filter((token) => token.startsWith('source.'))).toEqual([]);
  });

  it('keeps the six legacy aliases resolving', () => {
    const catalog = buildFor('person');

    for (const alias of [
      'name',
      'firstName',
      'lastName',
      'fullName',
      'company',
      'companyName',
    ]) {
      expect(findTemplateVariable(catalog, alias)).not.toBeNull();
    }
  });
});

describe('a related source', () => {
  it("lists the SOURCE object's own fields under `source.`, including name and a custom field", () => {
    const tokens = tokensOf('opportunity');

    expect(tokens).toContain('source.name');
    expect(tokens).toContain('source.amount');
    expect(tokens).toContain('source.stage');
    // A custom field is covered, which is what "the source's own metadata" means.
    expect(tokens).toContain('source.customScore');
  });

  it('keeps the recipient Person in a SEPARATE group, still namespaced `person`', () => {
    const tokens = tokensOf('opportunity');

    expect(tokens).toContain('person.jobTitle');
    expect(tokens).toContain('person.firstName');
    // The aliases belong to the RECIPIENT, so a saved `@name` keeps meaning the
    // person it always meant.
    expect(findTemplateVariable(buildFor('opportunity'), 'name')?.token).toBe(
      'person.firstName',
    );
  });

  it('never leaks a secret-looking or non-scalar source field', () => {
    const tokens = tokensOf('opportunity');

    expect(tokens).not.toContain('source.apiKey');
    expect(tokens).not.toContain('source.pointOfContact');
    expect(tokens).not.toContain('source.company');
    expect(tokens).not.toContain('source.id');
    expect(tokens).not.toContain('source.createdAt');
  });

  it('groups the picker into titled source / recipient / company groups', () => {
    const groups = listTemplateVariableGroups(
      buildFor('opportunity'),
      'فرصت‌ها',
    );

    // The source group is titled with the workspace's OWN label for the object.
    expect(groups[0].key).toBe('source');
    expect(groups[0].title).toBe('فرصت‌ها');
    expect(groups[0].variables.map((variable) => variable.token)).toContain(
      '@source.name',
    );

    expect(groups[1].key).toBe('recipient');
    expect(groups[1].variables.map((variable) => variable.token)).toContain(
      '@person.firstName',
    );

    // No group is ever emitted empty.
    for (const group of groups) {
      expect(group.variables.length).toBeGreaterThan(0);
    }
  });

  it('a Person source yields ONE group, because there is no recipient to separate', () => {
    const groups = listTemplateVariableGroups(buildFor('person'), 'اشخاص');

    expect(groups.filter((group) => group.key === 'recipient')).toEqual([]);
    expect(groups.filter((group) => group.key === 'source')).toHaveLength(1);
  });
});

describe('the catalog follows the source, and never falls back to Person', () => {
  it('switching source changes the tokens, and switching back removes the others', () => {
    const personTokens = tokensOf('person');
    const opportunityTokens = tokensOf('opportunity');

    expect(personTokens).not.toContain('source.name');
    expect(opportunityTokens).not.toContain('source.jobTitle');
    expect(opportunityTokens.filter((t) => t.startsWith('source.'))).not.toEqual(
      [],
    );
    expect(tokensOf('person')).toEqual(personTokens);
  });

  it('an unknown source yields NO variables rather than Person variables', () => {
    // Both layers are checked: the pure builder must not invent a catalog for a
    // source the workspace does not define, and the runtime entry point must
    // report the case explicitly instead of silently rebasing on Person.
    const catalog = buildFor('doesNotExist');

    expect(catalog.variables).toEqual([]);
    expect(findTemplateVariable(catalog, 'person.firstName')).toBeNull();
    expect(findTemplateVariable(catalog, 'name')).toBeNull();
  });

  it('the runtime entry point reports SOURCE_UNKNOWN and an empty catalog', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: { query: async () => ({}) } as never,
      source: { objectName: 'doesNotExist' },
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNKNOWN');
    expect(result.catalog.variables).toEqual([]);
  });

  it('reports SOURCE_UNAVAILABLE when no source field could be authorized', async () => {
    // The source object exists but no record of it is readable, so no field of
    // it can be proven — and the catalog must not degrade into the recipient's
    // fields, which is the same defect wearing a different hat.
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: {
        query: async (payload: Record<string, unknown>) =>
          'opportunities' in payload
            ? { opportunities: { edges: [] } }
            : { person: { id: 'p1' } },
      } as never,
      source: OPPORTUNITY_CATALOG_SOURCE,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNAVAILABLE');
    expect(result.catalog.variables).toEqual([]);
  });
});

describe('resolveTemplateValues reads @source.* from the source record', () => {
  it('resolves the source record and the recipient independently', async () => {
    // Two DIFFERENT opportunity records that point at the SAME Person: the source
    // values must differ while the person values stay identical.
    const query = async (payload: Record<string, unknown>) => {
      if ('opportunity' in payload) {
        const selection = payload.opportunity as Record<string, unknown>;
        return {
          opportunity: {
            name: 'API Integration Deal',
            amount: { amountMicros: 75_000_000_000 },
            customScore: 42,
            jobTitle: selection.jobTitle,
          },
        };
      }

      return {
        person: {
          id: 'p1',
          name: { firstName: 'Reza', lastName: 'Beta' },
          jobTitle: 'CTO',
        },
      };
    };

    const resolved = await resolveTemplateValues({
      client: { query } as never,
      personId: 'p1',
      sourceRecord: { objectName: 'opportunity', recordId: 'o1' },
      catalog: buildFor('opportunity'),
    });

    expect(resolved.isAccessible).toBe(true);
    expect(resolved.isSourceAccessible).toBe(true);
    expect(resolved.values.get('source.name')).toBe('API Integration Deal');
    expect(resolved.values.get('source.customScore')).toBe('42');
    // The recipient comes from the Person, not from the source record.
    expect(resolved.values.get('person.firstName')).toBe('Reza');
    expect(resolved.values.get('person.jobTitle')).toBe('CTO');
  });

  it('a Person source reads nothing extra: the record IS the recipient', async () => {
    const query = async () => ({
      person: {
        id: 'p1',
        name: { firstName: 'Reza', lastName: 'Beta' },
        jobTitle: 'CTO',
      },
    });

    const resolved = await resolveTemplateValues({
      client: { query } as never,
      personId: 'p1',
      sourceRecord: null,
      catalog: buildFor('person'),
    });

    expect(resolved.values.get('person.firstName')).toBe('Reza');
    expect(resolved.isSourceAccessible).toBe(true);
  });

  it('an unreadable source record leaves its tokens unresolved instead of borrowing the recipient', async () => {
    const query = async (payload: Record<string, unknown>) =>
      'opportunity' in payload
        ? { opportunity: null }
        : { person: { id: 'p1', name: { firstName: 'Reza', lastName: 'Beta' } } };

    const resolved = await resolveTemplateValues({
      client: { query } as never,
      personId: 'p1',
      sourceRecord: { objectName: 'opportunity', recordId: 'gone' },
      catalog: buildFor('opportunity'),
    });

    expect(resolved.isSourceAccessible).toBe(false);
    expect(resolved.values.get('source.name')).toBeNull();
    expect(resolved.values.get('person.firstName')).toBe('Reza');
  });
});

describe('the picker never advertises an alias as a canonical token', () => {
  it('exposes canonical tokens only', () => {
    const groups = listTemplateVariableGroups(buildFor('person'), 'اشخاص');
    const tokens = groups.flatMap((group) =>
      group.variables.map((variable) => variable.token),
    );

    expect(tokens).toContain('@person.firstName');
    expect(tokens).not.toContain('@name');
    expect(tokens).not.toContain('@company');
  });
});

describe('the whole server pipeline, for a Person source', () => {
  it('authorizes the person fields plus the company, with the aliases intact', async () => {
    // A fake core client that reports every selected key as readable EXCEPT the
    // Company, where only `name` comes back — so the authority of the probe is
    // exercised rather than assumed.
    const client = {
      query: async (payload: Record<string, unknown>) => {
        if ('people' in payload) {
          return {
            people: { edges: [{ node: { id: 'p1', company: { id: 'c1' } } }] },
          };
        }

        const selection = (payload.person ?? {}) as Record<string, unknown>;
        const projected: Record<string, unknown> = {};

        for (const key of Object.keys(selection)) {
          if (key === '__args') {
            continue;
          }

          if (key === 'company') {
            projected.company = { name: null };
            continue;
          }

          projected[key] = null;
        }

        return { person: { id: 'p1', ...projected } };
      },
    };

    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: client as never,
      source: PERSON_CATALOG_SOURCE,
    });

    expect(result.isAvailable).toBe(true);
    // The group title is the workspace's own label for the source object.
    expect(result.sourceLabelPlural).toBe('People');

    const tokens = result.catalog.variables.map((variable) => variable.token);

    expect(tokens).toContain('person.firstName');
    expect(tokens).toContain('person.jobTitle');
    expect(tokens).toContain('company.name');
    // A Person source adds NO `source.*` copy of the same fields.
    expect(tokens.filter((token) => token.startsWith('source.'))).toEqual([]);

    // The six legacy aliases survive the entire pipeline, so saved templates
    // (@name, @company, …) keep resolving to the same definitions.
    expect(findTemplateVariable(result.catalog, 'name')?.token).toBe(
      'person.firstName',
    );
    expect(findTemplateVariable(result.catalog, 'company')?.token).toBe(
      'company.name',
    );
  });
});
