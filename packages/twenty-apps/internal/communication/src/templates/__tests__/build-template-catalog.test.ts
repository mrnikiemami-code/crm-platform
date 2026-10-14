import { describe, expect, it } from 'vitest';

import {
  buildAuthorizedTemplateCatalog,
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
  const buildMetadataClient = ({
    role,
    defaultRoleId = null,
    legacyRoleId = null,
  }: {
    role: unknown;
    defaultRoleId?: string | null;
    legacyRoleId?: string | null;
  }) => ({
    query: async () => ({
      findOneApplication: {
        defaultRoleId,
        defaultLogicFunctionRole:
          legacyRoleId === null ? null : { id: legacyRoleId },
      },
      getRoles: role === null ? [] : [role],
    }),
  });

  it('resolves the app role through the Application defaultRoleId', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: buildMetadataClient({
        defaultRoleId: 'role-app',
        role: {
          id: 'role-app',
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
        },
      }) as never,
    });

    expect(permissions).not.toBeNull();
    expect(permissions?.canReadAllObjectRecords).toBe(true);
    expect(permissions?.objectPermissions[0].restrictedFieldNames).toEqual([
      'loyaltyTier',
    ]);
    expect(permissions?.objectPermissions[0].restrictedFieldMetadataIds).toEqual([
      'x-1',
    ]);
    expect(permissions?.unreadableFieldMetadataIds).toEqual([
      JOB_TITLE_FIELD_ID,
    ]);
  });

  it('falls back to the declared role identifier when defaultRoleId is absent', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: buildMetadataClient({
        role: {
          id: 'role-declared',
          universalIdentifier: 'a7517c4b-7257-409f-9bfd-b15817bdc623',
          canReadAllObjectRecords: true,
          objectPermissions: [],
          fieldPermissions: [],
        },
      }) as never,
    });

    expect(permissions?.canReadAllObjectRecords).toBe(true);
  });

  it('also accepts a resolvable defaultLogicFunctionRole id', async () => {
    // The Application read is now only an OPTIONAL refinement: when it is denied
    // the declared role identifier still resolves the app's role from the list,
    // and when the list itself is empty the catalog fails closed.
    const permissions = await readTemplatePermissions({
      metadataClient: {
        query: async (request: Record<string, unknown>) => {
          if ('getRoles' in request) {
            return { getRoles: [] };
          }

          return {
            findOneApplication: {
              defaultRoleId: 'role-app',
            },
          };
        },
      } as never,
    });

    expect(permissions).toBeNull();
  });

  it('resolves the role by the declared identifier when the role list is the only source', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: {
        query: async (request: Record<string, unknown>) => {
          if ('getRoles' in request) {
            return {
              getRoles: [
                {
                  id: 'role-app',
                  universalIdentifier: 'a7517c4b-7257-409f-9bfd-b15817bdc623',
                  canReadAllObjectRecords: true,
                  objectPermissions: [],
                  fieldPermissions: [],
                },
              ],
            };
          }

          // The Application read is an OPTIONAL refinement that may be denied.
          throw new Error('Entity performing the request does not have permission');
        },
      } as never,
    });

    // A denied Application read must NOT invalidate a role the list provided.
    expect(permissions?.canReadAllObjectRecords).toBe(true);
  });

  it('prefers the defaultRoleId row over an unrelated role in the list', async () => {
    const metadataClient = {
      query: async (request: Record<string, unknown>) => {
        if ('getRoles' in request) {
          return {
            getRoles: [
              {
                id: 'role-admin',
                universalIdentifier: 'admin',
                canReadAllObjectRecords: true,
                objectPermissions: [],
                fieldPermissions: [],
              },
              {
                id: 'role-app',
                universalIdentifier: 'app',
                canReadAllObjectRecords: false,
                objectPermissions: [],
                fieldPermissions: [],
              },
            ],
          };
        }

        return {
          findOneApplication: {
            defaultRoleId: 'role-app',
            defaultLogicFunctionRole: null,
          },
        };
      },
    };

    const permissions = await readTemplatePermissions({
      metadataClient: metadataClient as never,
    });

    // The app's OWN role is chosen, not the first (administrator) row.
    expect(permissions?.canReadAllObjectRecords).toBe(false);
  });

  it('returns null (fail closed) when no role resolves', async () => {
    const permissions = await readTemplatePermissions({
      metadataClient: buildMetadataClient({ role: null }) as never,
    });

    // A role that cannot be resolved must never be treated as "allow
    // everything"; the caller turns this into an EMPTY, UNAVAILABLE catalog.
    expect(permissions).toBeNull();
  });
});

describe('buildAuthorizedTemplateCatalog — fail closed (W18-B)', () => {
  it('returns an EMPTY catalog and isAvailable=false when no role resolves', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      // Metadata enumerates fine, but the permission read yields no role.
      metadataClient: {
        query: async (request: Record<string, unknown>) => {
          if ('getRoles' in request) {
            return { getRoles: [] };
          }

          return {
            objects: {
              edges: templateMetadataObjects.map((object) => ({
                node: {
                  id: object.id,
                  nameSingular: object.nameSingular,
                  fieldsList: object.fields,
                },
              })),
            },
            findOneApplication: {
              defaultRoleId: null,
              defaultLogicFunctionRole: null,
            },
          };
        },
      } as never,
    });

    // Fields are NEVER advertised just because metadata enumeration succeeded.
    expect(result.isAvailable).toBe(false);
    expect(result.catalog.variables).toHaveLength(0);
    expect(findTemplateVariable(result.catalog, 'person.firstName')).toBeNull();
  });

  it('returns an EMPTY, unavailable catalog when the metadata read throws', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: {
        query: async () => {
          throw new Error('boom: https://internal.example/secret');
        },
      } as never,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.catalog.variables).toHaveLength(0);
  });
});
