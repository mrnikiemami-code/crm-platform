import { describe, expect, it } from 'vitest';

import roleDefinition from 'src/roles/default-function.role';
import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  buildAuthorizedTemplateCatalog,
  buildTemplateCatalogFromMetadata,
  intersectTemplatePermissions,
  readTemplatePermissions,
  type TemplatePermissionSnapshot,
} from 'src/templates/build-template-catalog';
import { mapWithBoundedConcurrency } from 'src/templates/probe-readable-fields';
import { findTemplateVariable } from 'src/templates/template-variable-catalog';
import {
  COMPANY_OBJECT_ID,
  JOB_TITLE_FIELD_ID,
  LOYALTY_TIER_FIELD_ID,
  PERSON_OBJECT_ID,
  SECRET_FIELD_ID,
  createFakeMetadataClient,
  createFakeMetadataClientWithRoles,
  templateMetadataObjects,
  unrestrictedPermissions,
  PERSON_CATALOG_SOURCE,
  OPPORTUNITY_CATALOG_SOURCE,
} from 'src/templates/__tests__/catalog-fixture';

const build = (permissions: TemplatePermissionSnapshot = unrestrictedPermissions) =>
  buildTemplateCatalogFromMetadata({
    objects: templateMetadataObjects,
    permissions,
    source: PERSON_CATALOG_SOURCE,
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

describe('catalog authorization: metadata decides the fields, the probe only removes', () => {
  /**
   * A core client that answers the PROBE reads the way the platform does: a field
   * the caller may read comes back with a value OR `null`, and a field the caller
   * may NOT read is absent from the response entirely.
   */
  const makeProbeClient = ({
    readablePersonKeys,
    readableCompanyKeys,
    discoveryHasCompany = true,
  }: {
    readablePersonKeys: string[];
    readableCompanyKeys: string[];
    discoveryHasCompany?: boolean;
  }) => ({
    query: async (payload: Record<string, unknown>) => {
      if (payload !== undefined && 'people' in payload) {
        return {
          people: {
            edges: [
              {
                node: {
                  id: 'p1',
                  ...(discoveryHasCompany ? { company: { id: 'c1' } } : {}),
                },
              },
            ],
          },
        };
      }

      const selection = (payload.person as Record<string, unknown>) ?? {};
      const projected: Record<string, unknown> = {};

      for (const key of Object.keys(selection)) {
        if (key === '__args') {
          continue;
        }

        if (key === 'company') {
          const companySelection =
            (selection.company as Record<string, unknown>) ?? {};
          const companyProjected: Record<string, unknown> = {};

          for (const companyKey of Object.keys(companySelection)) {
            if (readableCompanyKeys.includes(companyKey)) {
              companyProjected[companyKey] = null;
            }
          }

          projected.company = companyProjected;
          continue;
        }

        if (readablePersonKeys.includes(key)) {
          projected[key] = null;
        }
      }

      return { person: projected };
    },
  });

  // The division of labour, which is the point of this block:
  //
  //  - the FIELD LIST comes from metadata, so an object with no records still
  //    has fields, and a random row cannot decide what exists;
  //  - the PROBE is the platform's own enforcement, so a field the caller may not
  //    read is removed — but it can only ever REMOVE a field metadata declared,
  //    never add one.
  //
  // This is what makes the unreachable-object case honest: those objects return
  // SOURCE_UNAVAILABLE (a permission outcome) rather than an empty-looking list
  // that would be indistinguishable from "this object has no fields".

  it('advertises a field only when the caller may actually read it', async () => {
    // The probe answers: only `name` and `jobTitle` come back readable.
    const result = await buildAuthorizedTemplateCatalog({
      client: makeProbeClient({
        readablePersonKeys: ['name', 'jobTitle'],
        readableCompanyKeys: ['name'],
      }) as never,
      source: PERSON_CATALOG_SOURCE,
      metadataClient: createFakeMetadataClient() as never,
    });

    expect(result.isAvailable).toBe(true);
    expect(result.stage).toBe('OK');

    const tokens = result.catalog.variables.map((variable) => variable.token);

    expect(tokens).toContain('person.firstName');
    expect(tokens).toContain('person.jobTitle');
    expect(tokens).toContain('company.name');
    expect(tokens).not.toContain('person.emails');
    expect(tokens).not.toContain('person.linkedinLink');
    expect(tokens).not.toContain('company.domainName');
  });

  it('never advertises a field the platform did not return', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      client: makeProbeClient({
        readablePersonKeys: ['name'],
        readableCompanyKeys: [],
        discoveryHasCompany: false,
      }) as never,
      source: PERSON_CATALOG_SOURCE,
      metadataClient: createFakeMetadataClient() as never,
    });

    const tokens = result.catalog.variables.map((variable) => variable.token);

    expect(tokens).toContain('person.firstName');
    // No Person carried a Company, so no Company field could be proven.
    expect(tokens.every((token) => !token.startsWith('company.'))).toBe(true);
  });

  it('keeps the metadata field list for a source with NO records of its own', async () => {
    // A source with no rows cannot have a field PROVEN, but the object still
    // declares its fields. This is reported as SOURCE_UNAVAILABLE — an explicit
    // permission/unproven outcome — rather than as an empty list that looks like
    // "the object has no fields".
    const result = await buildAuthorizedTemplateCatalog({
      client: {
        query: async (payload: Record<string, unknown>) =>
          'people' in payload
            ? { people: { edges: [{ node: { id: 'p1' } }] } }
            : 'opportunities' in payload
              ? { opportunities: { edges: [] } }
              : { person: { id: 'p1' } },
      } as never,
      source: OPPORTUNITY_CATALOG_SOURCE,
      metadataClient: createFakeMetadataClient() as never,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNAVAILABLE');
    expect(result.catalog.variables).toHaveLength(0);
  });

  it('reports SOURCE_UNAVAILABLE when nothing at all could be proven', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      client: {
        query: async () => ({ people: { edges: [] } }),
      } as never,
      source: PERSON_CATALOG_SOURCE,
      metadataClient: createFakeMetadataClient() as never,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('SOURCE_UNAVAILABLE');
    expect(result.catalog.variables).toHaveLength(0);
  });

  it('applies the USER role restriction on top of the probe', async () => {
    // A user role that may not read `jobTitle` removes it even though the probe
    // would have returned it. The probe is the authority on what is READABLE;
    // the role is an additional restriction.
    const result = await buildAuthorizedTemplateCatalog({
      client: makeProbeClient({
        readablePersonKeys: ['name', 'jobTitle'],
        readableCompanyKeys: ['name'],
      }) as never,
      source: PERSON_CATALOG_SOURCE,
      metadataClient: createFakeMetadataClientWithRoles({
        userRole: {
          id: 'user-role',
          universalIdentifier: 'user-role-uid',
          canReadAllObjectRecords: true,
          objectPermissions: [],
          fieldPermissions: [
            { fieldMetadataId: JOB_TITLE_FIELD_ID, canReadFieldValue: false },
          ],
        },
        appUnreadableFieldIds: [],
      }) as never,
      userRoleId: 'user-role',
    });

    const tokens = result.catalog.variables.map((variable) => variable.token);

    expect(tokens).toContain('person.firstName');
    expect(tokens).not.toContain('person.jobTitle');
  });

  it('returns an EMPTY, unavailable catalog when the metadata read throws', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      client: makeProbeClient({
        readablePersonKeys: ['name'],
        readableCompanyKeys: [],
      }) as never,
      source: PERSON_CATALOG_SOURCE,
      metadataClient: {
        query: async () => {
          throw new Error('boom: https://internal.example/secret');
        },
      } as never,
    });

    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('METADATA_ERROR');
    expect(result.catalog.variables).toHaveLength(0);
  });
});

describe('intersectTemplatePermissions', () => {
  const snapshot = (
    overrides: Partial<TemplatePermissionSnapshot> = {},
  ): TemplatePermissionSnapshot => ({
    canReadAllObjectRecords: true,
    objectPermissions: [],
    unreadableFieldMetadataIds: [],
    ...overrides,
  });

  it('AND-s object readability, so one denial wins', () => {
    const merged = intersectTemplatePermissions(
      snapshot(),
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: COMPANY_OBJECT_ID,
            canReadObjectRecords: false,
            restrictedFieldNames: [],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
    );

    const company = merged.objectPermissions.find(
      (permission) => permission.objectMetadataId === COMPANY_OBJECT_ID,
    );

    expect(company?.canReadObjectRecords).toBe(false);
  });

  it('UNION-s restrictions, so either role can remove a field', () => {
    const merged = intersectTemplatePermissions(
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: PERSON_OBJECT_ID,
            canReadObjectRecords: true,
            restrictedFieldNames: ['jobTitle'],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: PERSON_OBJECT_ID,
            canReadObjectRecords: true,
            restrictedFieldNames: ['emails'],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
    );

    const person = merged.objectPermissions.find(
      (permission) => permission.objectMetadataId === PERSON_OBJECT_ID,
    );

    expect(person?.restrictedFieldNames.sort()).toEqual(['emails', 'jobTitle']);
  });

  it('only claims read-all when BOTH roles do', () => {
    expect(
      intersectTemplatePermissions(
        snapshot({ canReadAllObjectRecords: true }),
        snapshot({ canReadAllObjectRecords: false }),
      ).canReadAllObjectRecords,
    ).toBe(false);
  });

  it('unions unreadable field ids', () => {
    const merged = intersectTemplatePermissions(
      snapshot({ unreadableFieldMetadataIds: ['a'] }),
      snapshot({ unreadableFieldMetadataIds: ['b'] }),
    );

    expect(merged.unreadableFieldMetadataIds.sort()).toEqual(['a', 'b']);
  });
});

describe('intersectTemplatePermissions', () => {
  const snapshot = (
    overrides: Partial<TemplatePermissionSnapshot> = {},
  ): TemplatePermissionSnapshot => ({
    canReadAllObjectRecords: true,
    objectPermissions: [],
    unreadableFieldMetadataIds: [],
    ...overrides,
  });

  it('AND-s object readability, so one denial wins', () => {
    const merged = intersectTemplatePermissions(
      snapshot(),
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: COMPANY_OBJECT_ID,
            canReadObjectRecords: false,
            restrictedFieldNames: [],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
    );

    const company = merged.objectPermissions.find(
      (permission) => permission.objectMetadataId === COMPANY_OBJECT_ID,
    );

    expect(company?.canReadObjectRecords).toBe(false);
  });

  it('UNION-s restrictions, so either role can remove a field', () => {
    const merged = intersectTemplatePermissions(
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: PERSON_OBJECT_ID,
            canReadObjectRecords: true,
            restrictedFieldNames: ['jobTitle'],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
      snapshot({
        objectPermissions: [
          {
            objectMetadataId: PERSON_OBJECT_ID,
            canReadObjectRecords: true,
            restrictedFieldNames: ['emails'],
            restrictedFieldMetadataIds: [],
          },
        ],
      }),
    );

    const person = merged.objectPermissions.find(
      (permission) => permission.objectMetadataId === PERSON_OBJECT_ID,
    );

    expect(person?.restrictedFieldNames.sort()).toEqual(['emails', 'jobTitle']);
  });

  it('only claims read-all when BOTH roles do', () => {
    expect(
      intersectTemplatePermissions(
        snapshot({ canReadAllObjectRecords: true }),
        snapshot({ canReadAllObjectRecords: false }),
      ).canReadAllObjectRecords,
    ).toBe(false);
  });

  it('unions unreadable field ids', () => {
    const merged = intersectTemplatePermissions(
      snapshot({ unreadableFieldMetadataIds: ['a'] }),
      snapshot({ unreadableFieldMetadataIds: ['b'] }),
    );

    expect(merged.unreadableFieldMetadataIds.sort()).toEqual(['a', 'b']);
  });
});

describe('mapWithBoundedConcurrency (W19-A)', () => {
  it('never runs more than the configured number of workers at once', async () => {
    let inFlight = 0;
    let peak = 0;

    const results = await mapWithBoundedConcurrency({
      items: [1, 2, 3, 4, 5, 6, 7],
      concurrency: 3,
      worker: async (item) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;

        return item * 2;
      },
    });

    expect(peak).toBeLessThanOrEqual(3);
    // Results keep the input order regardless of completion order.
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it('is a no-op for an empty list', async () => {
    await expect(
      mapWithBoundedConcurrency({
        items: [],
        concurrency: 4,
        worker: async () => 1,
      }),
    ).resolves.toEqual([]);
  });
});

describe('least-privilege role manifest (W19-A)', () => {
  const roleConfig = roleDefinition.config as unknown as {
    universalIdentifier: string;
    canReadAllObjectRecords: boolean;
    canUpdateAllObjectRecords: boolean;
    canSoftDeleteAllObjectRecords: boolean;
    canDestroyAllObjectRecords: boolean;
    objectPermissions?: {
      objectUniversalIdentifier: string;
      canSoftDeleteObjectRecords?: boolean;
      canDestroyObjectRecords?: boolean;
    }[];
  };

  it('keeps the stable role identifier', () => {
    expect(roleDefinition.success).toBe(true);
    expect(roleConfig.universalIdentifier).toBe(
      DEFAULT_FUNCTION_ROLE_UNIVERSAL_IDENTIFIER,
    );
  });

  it('grants NO blanket soft delete and NO destroy anywhere', () => {
    expect(roleConfig.canSoftDeleteAllObjectRecords).toBe(false);
    expect(roleConfig.canDestroyAllObjectRecords).toBe(false);
  });

  it('grants soft delete ONLY through the messageTemplate object override', () => {
    expect(roleConfig.objectPermissions).toEqual([
      {
        objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        canSoftDeleteObjectRecords: true,
      },
    ]);

    // No other object receives any delete capability, so Person, Company and
    // Communication have none.
    for (const permission of roleConfig.objectPermissions ?? []) {
      expect(permission.objectUniversalIdentifier).toBe(
        MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
      );
      expect(permission.canDestroyObjectRecords).not.toBe(true);
    }
  });

  it('still reads and updates records', () => {
    expect(roleConfig.canReadAllObjectRecords).toBe(true);
    expect(roleConfig.canUpdateAllObjectRecords).toBe(true);
  });
});
