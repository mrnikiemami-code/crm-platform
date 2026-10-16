import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import { TemplateRecordReadError } from 'src/templates/data/query-template-records';
import {
  createFakeMetadataClient,
  templateMetadataObjects,
} from './catalog-fixture';
const emptyConnections = (request: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(request).map((key) => [key, { edges: [] }]));
describe('template field permissions without sampling data', () => {
  it('keeps empty fields and empty objects, and checks permissions without inspecting any row', async () => {
    const query = vi.fn(async (request: Record<string, unknown>) =>
      emptyConnections(request),
    );
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: { query },
      source: { objectName: 'opportunity' },
      authorizeWithoutRecords: true,
    });
    expect(result.isAvailable).toBe(true);
    expect(result.catalog.lookup.has('source.customscore')).toBe(true);
    expect(result.catalog.lookup.has('person.jobtitle')).toBe(true);
    for (const [request] of query.mock.calls) {
      const selection = Object.values(request)[0] as {
        __args: { first: number; filter: unknown };
      };
      expect(selection.__args.first).toBe(1);
      expect(selection.__args.filter).toEqual({
        and: [
          { id: { eq: '00000000-0000-0000-0000-000000000000' } },
          { id: { neq: '00000000-0000-0000-0000-000000000000' } },
        ],
      });
    }
  });
  it('removes a denied field on an empty table without silently removing other fields', async () => {
    const query = vi.fn(async (request: Record<string, unknown>) => {
      if (JSON.stringify(request).includes('jobTitle'))
        throw new TemplateRecordReadError('FORBIDDEN');
      return emptyConnections(request);
    });
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: { query },
      source: { objectName: 'person' },
      authorizeWithoutRecords: true,
    });
    expect(result.isAvailable).toBe(true);
    expect(result.catalog.lookup.has('person.jobtitle')).toBe(false);
    expect(result.catalog.lookup.has('person.firstname')).toBe(true);
  });
  it('reports broken transport or schema as an error instead of pretending fields are forbidden', async () => {
    const result = await buildAuthorizedTemplateCatalog({
      metadataClient: createFakeMetadataClient() as never,
      client: {
        query: vi.fn(async () => {
          throw new TemplateRecordReadError('QUERY_ERROR');
        }),
      },
      source: { objectName: templateMetadataObjects[0].nameSingular },
      authorizeWithoutRecords: true,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.stage).toBe('READ_PROBE_ERROR');
  });
});
