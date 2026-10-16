import {
  type TemplateMetadataObject,
  type TemplatePermissionSnapshot,
} from 'src/templates/build-template-catalog';

// Fixtures for the metadata-driven catalog tests. The shape mirrors what the
// workspace's metadata API actually returns for Person/Company on main/4D
// (verified live in W17-R1), so the filtering rules are exercised against
// realistic metadata rather than a convenient invention.
//
// This file is NOT a test (the runner only collects `*.test.ts`), it is shared
// input for several suites.

const field = (
  id: string,
  name: string,
  type: string,
  label: string,
  isSystem = false,
) => ({
  id,
  // Identity from metadata. Derived from the id so every fixture field has a
  // stable, distinct one — the same relationship the real metadata has.
  universalIdentifier: `uid-${id}`,
  name,
  type,
  label,
  description: '',
  isActive: true,
  isSystem,
});

export const PERSON_OBJECT_ID = '11111111-1111-4111-8111-111111111111';
export const COMPANY_OBJECT_ID = '22222222-2222-4222-8222-222222222222';

/**
 * The Person source, for the suites that exercise the Person-scoped catalog —
 * which is the shape every consumer used before the catalog became
 * source-driven. A Person source yields the person fields (as the SOURCE) plus
 * the company, so those expectations still hold.
 */
export const PERSON_CATALOG_SOURCE = { objectName: 'person' } as const;

export const JOB_TITLE_FIELD_ID = '33333333-3333-4333-8333-333333333333';
export const LOYALTY_TIER_FIELD_ID = '44444444-4444-4444-8444-444444444444';
export const SECRET_FIELD_ID = '55555555-5555-4555-8555-555555555555';

export const templateMetadataObjects: TemplateMetadataObject[] = [
  {
    id: PERSON_OBJECT_ID,
    nameSingular: 'person',
    universalIdentifier: 'uid-person',
    namePlural: 'people',
    labelPlural: 'People',
    fields: [
      field('p-id', 'id', 'UUID', 'Id', true),
      field('p-created', 'createdAt', 'DATE_TIME', 'Creation date', true),
      field('p-updated', 'updatedAt', 'DATE_TIME', 'Last update', true),
      field('p-deleted', 'deletedAt', 'DATE_TIME', 'Deleted at', true),
      field('p-name', 'name', 'FULL_NAME', 'Name'),
      field('p-emails', 'emails', 'EMAILS', 'Emails'),
      field('p-linkedin', 'linkedinLink', 'LINKS', 'LinkedIn'),
      field(JOB_TITLE_FIELD_ID, 'jobTitle', 'TEXT', 'Job Title'),
      field('p-phones', 'phones', 'PHONES', 'Phones'),
      field('p-avatar', 'avatarUrl', 'TEXT', 'Avatar', true),
      field('p-position', 'position', 'POSITION', 'Position', true),
      field('p-createdby', 'createdBy', 'ACTOR', 'Created by', true),
      field('p-company', 'company', 'RELATION', 'Company'),
      field('p-communications', 'communications', 'RELATION', 'Communications'),
      // A workspace CUSTOM scalar field: it must appear automatically.
      field(LOYALTY_TIER_FIELD_ID, 'loyaltyTier', 'TEXT', 'Loyalty Tier'),
      // A TEXT field whose NAME looks like a credential: never exposed.
      field(SECRET_FIELD_ID, 'apiToken', 'TEXT', 'Api Token'),
    ],
  },
  {
    id: COMPANY_OBJECT_ID,
    nameSingular: 'company',
    universalIdentifier: 'uid-company',
    namePlural: 'companies',
    labelPlural: 'Companies',
    fields: [
      field('c-id', 'id', 'UUID', 'Id', true),
      field('c-created', 'createdAt', 'DATE_TIME', 'Creation date', true),
      field('c-name', 'name', 'TEXT', 'Name'),
      field('c-domain', 'domainName', 'LINKS', 'Domain Name'),
      field('c-address', 'address', 'ADDRESS', 'Address'),
      field('c-linkedin', 'linkedinLink', 'LINKS', 'LinkedIn'),
      field('c-revenue', 'annualRevenue', 'CURRENCY', 'Annual Revenue'),
      field('c-position', 'position', 'POSITION', 'Position', true),
      field('c-people', 'people', 'RELATION', 'People'),
    ],
  },
  {
    // A RELATED source: its records reach a recipient Person through
    // `pointOfContact`. Present so the source-driven catalog can be tested
    // against a real second object, including one CUSTOM field — which is the
    // case the user reported as still showing Person variables.
    id: '66666666-6666-4666-8666-666666666666',
    nameSingular: 'opportunity',
    universalIdentifier: 'uid-opportunity',
    namePlural: 'opportunities',
    labelPlural: 'فرصت‌ها',
    fields: [
      field('o-id', 'id', 'UUID', 'Id', true),
      field('o-created', 'createdAt', 'DATE_TIME', 'Creation date', true),
      field('o-name', 'name', 'TEXT', 'Name'),
      field('o-amount', 'amount', 'CURRENCY', 'Amount'),
      field('o-stage', 'stage', 'SELECT', 'Stage'),
      field('o-score', 'customScore', 'NUMBER', 'Custom score'),
      field('o-secret', 'apiKey', 'TEXT', 'Api key'),
      field('o-contact', 'pointOfContact', 'RELATION', 'Point of Contact'),
      field('o-company', 'company', 'RELATION', 'Company'),
    ],
  },
];

/** The related-source catalog source used by the source-driven tests. */
export const OPPORTUNITY_CATALOG_SOURCE = {
  objectName: 'opportunity',
} as const;

export const unrestrictedPermissions: TemplatePermissionSnapshot = {
  canReadAllObjectRecords: true,
  objectPermissions: [],
  unreadableFieldMetadataIds: [],
};

/**
 * A metadata client whose role reads are DRIVEN BY THE TEST.
 *
 * The catalog's authorization is the intersection of the user's role and the
 * app's role, so tests must be able to state both. `createFakeMetadataClient`
 * returns one fixed, fully-permissive app role and is kept for suites that do not
 * care about permissions.
 */
export const createFakeMetadataClientWithRoles = ({
  userRole,
  appUnreadableFieldIds = [],
  appObjectPermissions = [],
}: {
  /** The role `getRoles` returns for the user's role id, or `null` for none. */
  userRole: {
    id: string;
    universalIdentifier: string;
    canReadAllObjectRecords: boolean;
    objectPermissions: {
      objectMetadataId: string;
      canReadObjectRecords: boolean | null;
      restrictedFields: unknown;
    }[];
    fieldPermissions: { fieldMetadataId: string; canReadFieldValue: boolean }[];
  } | null;
  /** Field ids the APP's own role may not read. */
  appUnreadableFieldIds?: string[];
  /** Object-level restrictions on the APP's own role. */
  appObjectPermissions?: {
    objectMetadataId: string;
    canReadObjectRecords: boolean | null;
    restrictedFields: unknown;
  }[];
}) => ({
  query: async (payload: Record<string, unknown>) => {
    if ('getRoles' in payload) {
      const roles = [
        {
          id: 'role-1',
          universalIdentifier: 'a7517c4b-7257-409f-9bfd-b15817bdc623',
          canReadAllObjectRecords: true,
          objectPermissions: appObjectPermissions,
          fieldPermissions: appUnreadableFieldIds.map((fieldMetadataId) => ({
            fieldMetadataId,
            canReadFieldValue: false,
          })),
        },
      ];

      if (userRole !== null) {
        roles.push({
          id: userRole.id,
          universalIdentifier: userRole.universalIdentifier,
          canReadAllObjectRecords: userRole.canReadAllObjectRecords,
          objectPermissions: userRole.objectPermissions,
          fieldPermissions: userRole.fieldPermissions,
        } as (typeof roles)[number]);
      }

      return { getRoles: roles };
    }

    if ('findOneApplication' in payload) {
      return {
        findOneApplication: {
          defaultRoleId: 'role-1',
          defaultLogicFunctionRole: null,
        },
      };
    }

    return {
      objects: {
        edges: templateMetadataObjects.map((object) => ({
          node: {
            id: object.id,
            universalIdentifier: object.universalIdentifier,
            nameSingular: object.nameSingular,
            namePlural: object.namePlural,
            labelPlural: object.labelPlural,
            fieldsList: object.fields,
          },
        })),
      },
    };
  },
});

/**
 * A fake metadata client returning the fixture metadata AND the app execution
 * role with full read access, in the shape the real `MetadataApiClient` query
 * returns. Both `objects` and `getRoles` are present on every response because
 * the catalog builder reads them concurrently.
 */
export const createFakeMetadataClient = () => ({
  query: async () => ({
    objects: {
      edges: templateMetadataObjects.map((object) => ({
        node: {
          id: object.id,
          nameSingular: object.nameSingular,
          namePlural: object.namePlural,
          labelPlural: object.labelPlural,
          fieldsList: object.fields,
        },
      })),
    },
    findOneApplication: {
      defaultRoleId: 'role-1',
      defaultLogicFunctionRole: null,
    },
    getRoles: [
      {
        id: 'role-1',
        universalIdentifier: 'a7517c4b-7257-409f-9bfd-b15817bdc623',
        canReadAllObjectRecords: true,
        objectPermissions: [],
        fieldPermissions: [],
      },
    ],
  }),
});

/** The canonical tokens the fixture catalog yields, in order. */
export const fixtureCatalogTokens = [
  'person.firstName',
  'person.lastName',
  'person.fullName',
  'person.emails',
  'person.linkedinLink',
  'person.jobTitle',
  'person.loyaltyTier',
  'company.name',
  'company.domainName',
  'company.linkedinLink',
  'company.annualRevenue',
] as const;

/**
 * A fake workspace client whose records expose EVERY requested field, so each
 * per-field probe authorizes every candidate. Tests about recipient resolution,
 * preview or sending (not about authorization) use this to get a usable catalog;
 * the authorization rules themselves are covered by dedicated probe tests.
 */
export const createAuthorizingCoreClient = ({
  nodes = [] as readonly unknown[],
}: { nodes?: readonly unknown[] } = {}) => ({
  query: async (payload: Record<string, unknown>) => {
    if (payload !== undefined && 'people' in payload) {
      return { people: { edges: nodes.map((node) => ({ node })) } };
    }

    if (payload !== undefined && 'person' in payload) {
      return { person: nodes.length > 0 ? nodes[0] : null };
    }

    return {};
  },
});
