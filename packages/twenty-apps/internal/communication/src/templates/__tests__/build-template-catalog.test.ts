import { describe, expect, it } from 'vitest';

import {
  buildTemplateCatalogFromMetadata,
  readTemplatePermissions,
  type TemplatePermissionSnapshot,
} from 'src/templates/build-template-catalog';
import { findTemplateVariable } from 'src/templates/template-variable-catalog';
import {
  COMPANY_OBJECT_ID,
  JOB_TITLE_FIELD_ID,
  LOYALTY_TIER_FIELD_ID,
  PERSON_OBJECT_ID,
  SECRET_FIELD_ID,
  templateMetadataObjects,
  unrestrictedPermissions,
} from 'src/templates/__tests__/catalog-fixture';

const build = (permissions: TemplatePermissionSnapshot = unrestrictedPermissions) =>
  buildTemplateCatalogFromMetadata({
    objects: templateMetadataObjects,
    permissions,
  });

const tokensOf = (permissions?: TemplatePermissionSnapshot) =>
  build(permissions).variables.map((variable) => variable.token);

describe('buildTemplateCatalogFromMetadata', () => {
  it('exposes Person scalars and the FULL_NAME subfields', () => {
    const tokens = tokensOf();

    expect(tokens.slice(0, 4)).toEqual([
      'person.firstName',
      'person.lastName',
      'person.fullName',
      'person.emails',
    ]);
    expect(tokens).toContain('person.linkedinLink');
    expect(tokens).toContain('person.jobTitle');
  });

  it('exposes Company scalars, including the Company name', () => {
    const tokens = tokensOf();

    expect(tokens).toContain('company.name');
    expect(tokens).toContain('company.domainName');
    expect(tokens).toContain('company.linkedinLink');
    expect(tokens).toContain('company.annualRevenue');
  });

  it('includes a workspace CUSTOM scalar field automatically', () => {
    const catalog = build();
    const entry = findTemplateVariable(catalog, 'person.loyaltyTier');

    expect(entry).not.toBeNull();
    expect(entry?.fieldName).toBe('loyaltyTier');
    expect(entry?.label).toBe('Loyalty Tier');
    expect(entry?.objectName).toBe('person');
  });

  it('never exposes system/audit fields, secrets, relations or complex values', () => {
    const tokens = tokensOf();

    // audit + system
    for (const blocked of [
      'person.id',
      'person.createdAt',
      'person.updatedAt',
      'person.deletedAt',
      'person.avatarUrl',
      'person.position',
    ]) {
      expect(tokens).not.toContain(blocked);
    }

    // secret-looking NAME, even though its type is allowed
    expect(tokens).not.toContain('person.apiToken');

    // collections / relations
    expect(tokens).not.toContain('person.communications');
    expect(tokens).not.toContain('company.people');

    // unsupported complex types
    expect(tokens).not.toContain('person.phones');
    expect(tokens).not.toContain('company.address');
    expect(tokens).not.toContain('person.createdBy');
  });

  it('keeps the six legacy aliases resolving to the canonical definitions', () => {
    const catalog = build();
    const aliases: [string, string][] = [
      ['name', 'person.firstName'],
      ['firstName', 'person.firstName'],
      ['lastName', 'person.lastName'],
      ['fullName', 'person.fullName'],
      ['company', 'company.name'],
      ['companyName', 'company.name'],
    ];

    for (const [alias, canonical] of aliases) {
      expect(findTemplateVariable(catalog, alias)?.token).toBe(canonical);
    }
  });

  it('is case-insensitive for both canonical tokens and aliases', () => {
    const catalog = build();

    expect(findTemplateVariable(catalog, 'PERSON.JOBTITLE')?.token).toBe(
      'person.jobTitle',
    );
    expect(findTemplateVariable(catalog, 'CompanyName')?.token).toBe(
      'company.name',
    );
  });

  it('drops an entire object when the role cannot read it', () => {
    const tokens = tokensOf({
      ...unrestrictedPermissions,
      objectPermissions: [
        {
          objectMetadataId: PERSON_OBJECT_ID,
          canReadObjectRecords: false,
          restrictedFieldNames: [],
          restrictedFieldMetadataIds: [],
        },
      ],
    });

    expect(tokens.every((token) => !token.startsWith('person.'))).toBe(true);
    expect(tokens).toContain('company.name');
    // and the legacy person aliases disappear with it
    expect(findTemplateVariable(build({
      ...unrestrictedPermissions,
      objectPermissions: [
        {
          objectMetadataId: PERSON_OBJECT_ID,
          canReadObjectRecords: false,
          restrictedFieldNames: [],
          restrictedFieldMetadataIds: [],
        },
      ],
    }), 'name')).toBeNull();
  });

  it('drops a field listed in restrictedFields by name', () => {
    const tokens = tokensOf({
      ...unrestrictedPermissions,
      objectPermissions: [
        {
          objectMetadataId: PERSON_OBJECT_ID,
          canReadObjectRecords: true,
          restrictedFieldNames: ['loyaltyTier'],
          restrictedFieldMetadataIds: [],
        },
      ],
    });

    expect(tokens).not.toContain('person.loyaltyTier');
    expect(tokens).toContain('person.jobTitle');
  });

  it('drops a field listed in restrictedFields by field metadata id', () => {
    const tokens = tokensOf({
      ...unrestrictedPermissions,
      objectPermissions: [
        {
          objectMetadataId: PERSON_OBJECT_ID,
          canReadObjectRecords: true,
          restrictedFieldNames: [],
          restrictedFieldMetadataIds: [LOYALTY_TIER_FIELD_ID],
        },
      ],
    });

    expect(tokens).not.toContain('person.loyaltyTier');
  });

  it('drops a field whose canReadFieldValue is false, and its object when denied', () => {
    const tokens = tokensOf({
      ...unrestrictedPermissions,
      objectPermissions: [
        {
          objectMetadataId: COMPANY_OBJECT_ID,
          canReadObjectRecords: true,
          restrictedFieldNames: [],
          restrictedFieldMetadataIds: [],
        },
      ],
      unreadableFieldMetadataIds: [JOB_TITLE_FIELD_ID],
    });

    expect(tokens).not.toContain('person.jobTitle');
    expect(tokens).toContain('person.loyaltyTier');
  });

  it('never exposes the secret field even when permissions would allow it', () => {
    const catalog = build();
    const entry = catalog.variables.find(
      (variable) => variable.fieldName === 'apiToken',
    );

    expect(entry).toBeUndefined();
    expect(SECRET_FIELD_ID).toBeTruthy();
  });
});

describe('readTemplatePermissions', () => {
  const buildMetadataClient = (role: unknown) => ({
    query: async () => ({ findOneApplication: { defaultLogicFunctionRole: role } }),
  });

  it('maps the app execution role restrictions', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: buildMetadataClient({
        id: 'role-1',
        universalIdentifier: 'a7517c4b-7257-409f-9bfd-b15817bdc623',
        canReadAllObjectRecords: true,
        objectPermissions: [
          {
            objectMetadataId: PERSON_OBJECT_ID,
            canReadObjectRecords: true,
            restrictedFields: ['loyaltyTier', { fieldMetadataId: 'x-1' }],
          },
        ],
        fieldPermissions: [
          { fieldMetadataId: JOB_TITLE_FIELD_ID, canReadFieldValue: false },
          { fieldMetadataId: LOYALTY_TIER_FIELD_ID, canReadFieldValue: true },
        ],
      }) as never,
    });

    expect(permissions.canReadAllObjectRecords).toBe(true);
    expect(permissions.objectPermissions[0].restrictedFieldNames).toEqual([
      'loyaltyTier',
    ]);
    expect(permissions.objectPermissions[0].restrictedFieldMetadataIds).toEqual([
      'x-1',
    ]);
    expect(permissions.unreadableFieldMetadataIds).toEqual([
      JOB_TITLE_FIELD_ID,
    ]);
  });

  it('denies everything when the app role cannot be read', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: buildMetadataClient(null) as never,
    });

    expect(permissions.canReadAllObjectRecords).toBe(false);
  });
});
