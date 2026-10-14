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
) => ({ id, name, type, label, isActive: true, isSystem });

export const PERSON_OBJECT_ID = '11111111-1111-4111-8111-111111111111';
export const COMPANY_OBJECT_ID = '22222222-2222-4222-8222-222222222222';

export const JOB_TITLE_FIELD_ID = '33333333-3333-4333-8333-333333333333';
export const LOYALTY_TIER_FIELD_ID = '44444444-4444-4444-8444-444444444444';
export const SECRET_FIELD_ID = '55555555-5555-4555-8555-555555555555';

export const templateMetadataObjects: TemplateMetadataObject[] = [
  {
    id: PERSON_OBJECT_ID,
    nameSingular: 'person',
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
];

export const unrestrictedPermissions: TemplatePermissionSnapshot = {
  canReadAllObjectRecords: true,
  objectPermissions: [],
  unreadableFieldMetadataIds: [],
};

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
