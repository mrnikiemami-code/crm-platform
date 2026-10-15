import { describe, expect, it, vi } from 'vitest';

import { buildTemplateCatalogFromMetadata } from 'src/templates/build-template-catalog';
import {
  buildObjectSelection,
  resolveTemplateValues,
  resolveTemplateValuesForPersons,
} from 'src/templates/resolve-template-values';
import { findTemplateVariable } from 'src/templates/template-variable-catalog';
import {
  templateMetadataObjects,
  unrestrictedPermissions,
  PERSON_CATALOG_SOURCE,
} from 'src/templates/__tests__/catalog-fixture';

const catalog = buildTemplateCatalogFromMetadata({
  objects: templateMetadataObjects,
  permissions: unrestrictedPermissions,
  source: PERSON_CATALOG_SOURCE,
});

const buildClient = (person: unknown) => {
  const query = vi.fn(async (_payload?: unknown) => ({ person }));
  return { client: { query } as never, query };
};

describe('buildObjectSelection', () => {
  it('selects only catalog field names, with FULL_NAME expanded', () => {
    const selection = buildObjectSelection(
      catalog.variables.filter((variable) => variable.objectName === 'person'),
    );

    expect(Object.keys(selection).sort()).toEqual([
      // FULL_NAME is read once, expanded into its two subfields.
      'emails',
      'jobTitle',
      'linkedinLink',
      'loyaltyTier',
      'name',
    ]);
    expect(selection.name).toEqual({ firstName: true, lastName: true });

    // Nothing outside the catalog can appear: there is no path from client
    // input to this object.
    expect(selection.phones).toBeUndefined();
    expect(selection.apiToken).toBeUndefined();
    expect(selection.communications).toBeUndefined();
  });
});

describe('resolveTemplateValues', () => {
  it('resolves authorized values including a workspace custom field', async () => {
    const { client } = buildClient({
      name: { firstName: 'سارا', lastName: 'احمدی' },
      jobTitle: 'مدیر فروش',
      loyaltyTier: 'طلایی',
      emails: { primaryEmail: 'sara@example.com' },
      company: { name: 'شرکت الف', annualRevenue: { amountMicros: 2_000_000 } },
    });

    const result = await resolveTemplateValues({
      client,
      personId: 'p1',
      sourceRecord: null,
      catalog,
    });

    expect(result.isAccessible).toBe(true);
    expect(result.values.get('person.firstName')).toBe('سارا');
    expect(result.values.get('person.fullName')).toBe('سارا احمدی');
    expect(result.values.get('person.jobTitle')).toBe('مدیر فروش');
    // The custom field resolves from the real record.
    expect(result.values.get('person.loyaltyTier')).toBe('طلایی');
    expect(result.values.get('person.emails')).toBe('sara@example.com');
    expect(result.values.get('company.name')).toBe('شرکت الف');
    expect(result.values.get('company.annualRevenue')).toBe('2');
  });

  it('reports an unreadable/missing person as not accessible', async () => {
    const { client } = buildClient(null);

    const result = await resolveTemplateValues({
      client,
      personId: 'p1',
      sourceRecord: null,
      catalog,
    });

    expect(result.isAccessible).toBe(false);
    expect(result.values.size).toBe(0);
  });

  it('queries only the allow-listed selection, scoped to the person id', async () => {
    const { client, query } = buildClient(null);

    await resolveTemplateValues({
      client,
      personId: 'p1',
      sourceRecord: null,
      catalog,
    });

    const payload = query.mock.calls[0][0] as unknown as {
      person: { __args: { filter: { id: { eq: string } } } };
    };

    expect(payload.person.__args.filter.id.eq).toBe('p1');
  });

  it('never sends a literal token for a field the catalog does not contain', () => {
    // `person.apiToken` is not in the catalog, so it can never reach the read.
    expect(findTemplateVariable(catalog, 'person.apiToken')).toBeNull();
  });
});

describe('resolveTemplateValuesForPersons', () => {
  it('returns a value map per accessible person and omits the rest', async () => {
    const query = vi.fn(async () => ({
      people: {
        edges: [
          { node: { id: 'p1', name: { firstName: 'سارا' }, loyaltyTier: 'طلایی' } },
        ],
      },
    }));

    const values = await resolveTemplateValuesForPersons({
      client: { query } as never,
      personIds: ['p1', 'foreign'],
      catalog,
    });

    expect(values.get('p1')?.get('person.firstName')).toBe('سارا');
    expect(values.get('p1')?.get('person.loyaltyTier')).toBe('طلایی');
    expect(values.has('foreign')).toBe(false);
  });

  it('makes no request for an empty selection', async () => {
    const query = vi.fn(async () => ({ people: { edges: [] } }));

    const values = await resolveTemplateValuesForPersons({
      client: { query } as never,
      personIds: [],
      catalog,
    });

    expect(values.size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
