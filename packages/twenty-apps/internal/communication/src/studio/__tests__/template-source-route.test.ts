import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { metadataQuery, generatedRead, mutation } = vi.hoisted(() => ({
  metadataQuery: vi.fn(),
  generatedRead: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock('twenty-client-sdk/metadata', () => ({
  MetadataApiClient: class {
    query = metadataQuery;
  },
}));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    query = generatedRead;
    mutation = mutation;
  },
}));
import definition from 'src/logic-functions/template-studio';
import { templateMetadataObjects } from 'src/templates/__tests__/catalog-fixture';
const handler = (
  definition.config as unknown as {
    handler: (event: unknown) => Promise<Record<string, unknown>>;
  }
).handler;
const sourceUid = 'uid-conference-booking';
const relationUid = 'uid-attendee';
const transport = vi.fn();
beforeEach(() => {
  vi.stubEnv('TWENTY_API_URL', 'https://crm.example.test');
  vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', 'delegated-test-token');
  generatedRead.mockReset();
  mutation.mockReset();
  transport.mockReset();
  generatedRead.mockRejectedValue(
    new Error('Object absent from application SDK'),
  );
  const objects = templateMetadataObjects.map((object) => ({
    ...object,
    fieldsList: object.fields,
    isActive: true,
  }));
  const source = {
    id: 'source-metadata-id',
    universalIdentifier: sourceUid,
    nameSingular: 'conferenceBooking',
    namePlural: 'conferenceBookings',
    labelPlural: 'رزروهای همایش',
    isActive: true,
    isSystem: false,
    fieldsList: [
      {
        id: 'name-field',
        universalIdentifier: 'uid-name',
        name: 'name',
        type: 'TEXT',
        label: 'نام',
        isActive: true,
      },
      {
        id: 'venue-field',
        universalIdentifier: 'uid-venue',
        name: 'venue',
        type: 'TEXT',
        label: 'محل',
        isActive: true,
      },
      {
        id: 'attendee-field',
        universalIdentifier: relationUid,
        name: 'attendee',
        type: 'RELATION',
        label: 'شرکت‌کننده',
        isActive: true,
        relation: {
          type: 'MANY_TO_ONE',
          targetObjectMetadata: {
            id: templateMetadataObjects[0].id,
            universalIdentifier: 'uid-person',
          },
        },
      },
    ],
  };
  metadataQuery.mockResolvedValue({
    objects: { edges: [...objects, source].map((node) => ({ node })) },
  });
  transport.mockImplementation(async (_url: string, options: RequestInit) => {
    const query = JSON.parse(String(options.body)).query as string;
    const root = /TemplateRecordRead \{ (\w+)/.exec(query)?.[1] ?? '';
    let data: Record<string, unknown>;
    if (query.includes('11111111-2222-4333-8444-555555555555'))
      data = { [root]: { edges: [] } };
    else if (root === 'messageTemplate')
      data = {
        messageTemplate: {
          id: 'template-id',
          sourceObjectUid: sourceUid,
          recipientRelationUid: relationUid,
        },
      };
    else if (root === 'conferenceBooking')
      data = {
        conferenceBooking: {
          id: query.includes('source-b') ? 'source-b' : 'source-a',
          venue: query.includes('source-b') ? 'شیراز' : 'تهران',
          attendee: { id: 'person-id' },
        },
      };
    else if (root === 'person')
      data = {
        person: {
          id: 'person-id',
          name: { firstName: 'Patrick' },
          jobTitle: 'مدیر فروش',
        },
      };
    else if (root === 'people')
      data = {
        people: {
          edges: [
            {
              node: {
                id: 'person-id',
                name: { firstName: 'Patrick' },
                phones: null,
              },
            },
          ],
        },
      };
    else data = { [root]: { edges: [] } };
    return new Response(JSON.stringify({ data }));
  });
  vi.stubGlobal('fetch', transport);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('template route with an independently owned source', () => {
  it('discovers and authorizes a future source without touching the generated schema or reading sample data', async () => {
    const result = await handler({
      userWorkspaceId: 'real-user-membership',
      body: {
        action: 'catalog',
        sourceObjectUid: sourceUid,
        recipientRelationUid: relationUid,
      },
    });
    expect(result.catalogStatus).toBe('READY');
    expect(result.variables).toEqual(
      expect.arrayContaining([{ token: '@source.venue', label: 'محل' }]),
    );
    for (const [, options] of transport.mock.calls)
      expect(JSON.parse(String(options.body)).query).toContain(
        '11111111-2222-4333-8444-555555555555',
      );
    expect(generatedRead).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
  it('resolves the typed job title and different source values for two records sharing the same person', async () => {
    for (const [sampleRecordId, venue] of [
      ['source-a', 'تهران'],
      ['source-b', 'شیراز'],
    ]) {
      const result = await handler({
        userWorkspaceId: 'real-user-membership',
        body: {
          action: 'preview',
          templateId: 'template-id',
          sourceObjectUid: sourceUid,
          recipientRelationUid: relationUid,
          sampleObjectName: 'conferenceBooking',
          sampleRecordId,
          body: 'سلام @name؛ @person.jobTitle؛ محل: @source.venue',
        },
      });
      expect(result.success).toBe(true);
      expect(result.previews).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            previewText: `سلام Patrick؛ مدیر فروش؛ محل: ${venue}`,
            hasUnresolvedVariables: false,
            issues: [],
          }),
        ]),
      );
    }
    expect(generatedRead).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });
});
