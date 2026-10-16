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
  createFakeMetadataClientWithRoles,
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
      source: { objectName: 'doesNotExist' },
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNKNOWN');
    expect(result.catalog.variables).toEqual([]);
  });

  it('keeps the SOURCE field list even when the object has NO records', async () => {
    // This replaces the old SOURCE_UNAVAILABLE expectation. That state existed
    // because the catalog was proven by probing a random record: with an empty
    // table the probe found nothing and the catalog came back EMPTY, as if the
    // object declared no fields. The field list is now derived from metadata and
    // permissions, so an empty source still yields its full list.
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      source: OPPORTUNITY_CATALOG_SOURCE,
    });

    expect(result.isAvailable).toBe(true);
    expect(result.stage).toBe('OK');

    const sourceTokens = result.catalog.variables
      .filter((variable) => variable.group === 'source')
      .map((variable) => variable.token);

    expect(sourceTokens).toContain('source.name');
    expect(sourceTokens).toContain('source.amount');
  });

  it('reports SOURCE_UNAVAILABLE when the SOURCE object is unreadable by the roles', async () => {
    // The genuine "nothing usable for this source" case: the object exists in
    // metadata but the effective permissions deny it, so there is no source field
    // — and the catalog must not degrade into the recipient's fields.
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClientWithRoles({
        userRole: {
          id: 'user-role',
          universalIdentifier: 'user-role-uid',
          canReadAllObjectRecords: true,
          objectPermissions: [
            {
              objectMetadataId: '66666666-6666-4666-8666-666666666666',
              canReadObjectRecords: false,
              restrictedFields: null,
            },
          ],
          fieldPermissions: [],
        },
        appUnreadableFieldIds: [],
      }) as never,
      source: OPPORTUNITY_CATALOG_SOURCE,
      userRoleId: 'user-role',
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNAVAILABLE');
    expect(result.catalog.variables).toEqual([]);
  });
});

describe('composite fields are selected by their sub-fields', () => {
  it('asks for a currency composite by amountMicros, not `true`', async () => {
    // Asking for a COMPOSITE field as `true` returns the KEY with a NULL value,
    // so the token resolves to nothing while looking authorized. Found live via
    // `@source.amount` on an Opportunity.
    const seen: Record<string, unknown>[] = [];

    const query = async (payload: Record<string, unknown>) => {
      if ('opportunity' in payload) {
        seen.push(payload.opportunity as Record<string, unknown>);
        return {
          opportunity: {
            name: 'Platform Migration',
            // Only a real sub-selection yields the object.
            amount: { amountMicros: 60_000_000_000, currencyCode: 'USD' },
          },
        };
      }

      return { person: { id: 'p1', name: { firstName: 'Reza', lastName: 'Beta' } } };
    };

    const resolved = await resolveTemplateValues({
      client: { query } as never,
      personId: 'p1',
      sourceRecord: { objectName: 'opportunity', recordId: 'o2' },
      catalog: buildFor('opportunity'),
    });

    expect(seen[0].amount).toEqual({
      amountMicros: true,
      currencyCode: true,
    });
    expect(resolved.values.get('source.amount')).toBe('60000');
    expect(resolved.values.get('source.name')).toBe('Platform Migration');
  });

  it('asks for emails and links by their primary sub-field', async () => {
    const seen: Record<string, unknown>[] = [];

    const resolved = await resolveTemplateValues({
      client: {
        query: async (payload: Record<string, unknown>) => {
          seen.push(payload.person as Record<string, unknown>);
          return {
            person: {
              id: 'p1',
              name: { firstName: 'Reza', lastName: 'Beta' },
              emails: { primaryEmail: 'reza@example.com' },
              linkedinLink: { primaryLinkUrl: 'https://in.example/reza' },
            },
          };
        },
      } as never,
      personId: 'p1',
      sourceRecord: null,
      catalog: buildFor('person'),
    });

    expect(seen[0].emails).toEqual({ primaryEmail: true });
    expect(seen[0].linkedinLink).toEqual({
      primaryLinkUrl: true,
      primaryLinkLabel: true,
    });
    expect(resolved.values.get('person.emails')).toBe('reza@example.com');
    expect(resolved.values.get('person.linkedinLink')).toBe(
      'https://in.example/reza',
    );
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
  it('advertises the person fields plus the company, with the aliases intact', async () => {
    // The catalog no longer reads records, so the only input is metadata and
    // permissions. `createFakeMetadataClient` grants both fully, which is what
    // this test is about: the pipeline's SHAPE for a Person source.
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
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
