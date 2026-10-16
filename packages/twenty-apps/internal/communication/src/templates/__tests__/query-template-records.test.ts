import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryTemplateRecords } from 'src/templates/data/query-template-records';

describe('workspace template record reads', () => {
  beforeEach(() => {
    vi.stubEnv('TWENTY_API_URL', 'https://crm.example.test/');
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', 'delegated-test-token');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('reads an object absent from the generated client with the existing delegated identity', async () => {
    const data = {
      eventLeads: {
        edges: [{ node: { id: 'selected', customValue: 'همایش' } }],
      },
    };
    const transport = vi.fn(async () => new Response(JSON.stringify({ data })));
    vi.stubGlobal('fetch', transport);
    expect(
      await queryTemplateRecords({
        eventLeads: {
          __args: {
            first: 20,
            orderBy: [{ createdAt: 'DescNullsLast' }],
            filter: { name: { ilike: '%"quoted"\nvalue%' } },
          },
          edges: { node: { id: true, customValue: true } },
        },
      }),
    ).toEqual(data);
    const [url, options] = transport.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://crm.example.test/graphql');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer delegated-test-token',
    });
    const body = JSON.parse(String(options.body));
    expect(body.query).toContain('eventLeads(');
    expect(body.query).toContain('orderBy:[{createdAt:DescNullsLast}]');
    expect(body.query).toContain('ilike:"%\\"quoted\\"\\nvalue%"');
  });
  it('does not return partial data when the platform refuses a field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { eventLeads: null },
              errors: [
                {
                  message: 'Permission denied',
                  extensions: { code: 'FORBIDDEN' },
                },
              ],
            }),
          ),
      ),
    );
    await expect(
      queryTemplateRecords({ eventLeads: { edges: { node: { id: true } } } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('refuses missing delegated credentials and never substitutes an API key', async () => {
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', '');
    vi.stubEnv('TWENTY_API_KEY', 'must-not-be-used');
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(
      queryTemplateRecords({ people: { edges: { node: { id: true } } } }),
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects names and order values that could inject GraphQL', async () => {
    const transport = vi.fn();
    vi.stubGlobal('fetch', transport);
    await expect(queryTemplateRecords({ 'people){id}': true })).rejects.toThrow(
      'Invalid record query name',
    );
    await expect(
      queryTemplateRecords({
        people: { __args: { orderBy: [{ name: 'Desc){id}' }] }, id: true },
      }),
    ).rejects.toThrow('Invalid record order');
    expect(transport).not.toHaveBeenCalled();
  });
});
