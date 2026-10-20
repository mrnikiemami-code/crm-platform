import { buildApiCatalog } from 'src/engine/core-modules/well-known/utils/build-api-catalog.util';

describe('buildApiCatalog', () => {
  const baseUrl = 'https://mycompany.twenty.com';
  const helpUrl = 'https://app.mycompany.example/help';

  it('anchors each surface at its canonical API URL on the given host', () => {
    const catalog = buildApiCatalog(baseUrl, helpUrl);

    const anchors = catalog.linkset.map((entry) => entry.anchor);

    expect(anchors).toEqual([
      `${baseUrl}/rest`,
      `${baseUrl}/rest/metadata`,
      `${baseUrl}/graphql`,
      `${baseUrl}/mcp`,
    ]);
  });

  it('points the REST core surface at its live per-host OpenAPI + OAuth metadata', () => {
    const catalog = buildApiCatalog(baseUrl, helpUrl);

    const restCore = catalog.linkset.find(
      (entry) => entry.anchor === `${baseUrl}/rest`,
    );

    expect(restCore?.['service-desc']).toEqual([
      { href: `${baseUrl}/rest/open-api/core`, type: 'application/json' },
    ]);
    expect(restCore?.['service-meta']).toEqual([
      {
        href: `${baseUrl}/.well-known/oauth-protected-resource`,
        type: 'application/json',
      },
    ]);
  });

  it('references the MCP server card for the MCP surface', () => {
    const catalog = buildApiCatalog(baseUrl, helpUrl);

    const mcp = catalog.linkset.find(
      (entry) => entry.anchor === `${baseUrl}/mcp`,
    );

    expect(mcp?.['service-desc']).toEqual([
      {
        href: `${baseUrl}/.well-known/mcp/server-card.json`,
        type: 'application/json',
      },
    ]);
  });

  it('uses the caller-supplied help origin for every service-doc entry', () => {
    const catalog = buildApiCatalog(baseUrl, helpUrl);

    for (const entry of catalog.linkset) {
      expect(entry['service-doc']?.[0]?.href).toBe(helpUrl);
      expect(entry['service-doc']?.[0]?.href).not.toMatch(/docs\.twenty\.com/);
    }
  });

  it('keeps API anchors on the API host while help lives on a split front origin', () => {
    const splitFrontHelpUrl = 'https://app.customer.example/help';

    const catalog = buildApiCatalog('https://api.customer.example', splitFrontHelpUrl);

    for (const entry of catalog.linkset) {
      expect(entry.anchor.startsWith('https://api.customer.example')).toBe(true);
      expect(entry['service-doc']?.[0]?.href).toBe(splitFrontHelpUrl);
    }
  });

  it('omits service-doc instead of emitting a relative help link', () => {
    const catalog = buildApiCatalog(baseUrl, null);

    for (const entry of catalog.linkset) {
      expect(entry['service-doc']).toBeUndefined();
    }

    expect(JSON.stringify(catalog)).not.toContain('/help');
  });
});
