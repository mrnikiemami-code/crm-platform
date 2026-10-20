import { ApiPath } from 'twenty-shared/types';

// service-desc points at each host's live OpenAPI, which is generated per
// workspace and so includes that workspace's custom objects.
//
// service-doc points at the built-in help centre. Its origin is supplied by the
// caller from validated installation configuration (`FRONTEND_URL`, else
// `SERVER_URL`) — never from Host headers or request bodies — because the help
// UI can be served from a different public origin than this API.
//
// A `null` help URL means the installation has no valid published origin: the
// `service-doc` entries are then omitted rather than pointing at a relative or
// broken `/help`.
type ApiCatalogLink = {
  anchor: string;
  'service-doc'?: { href: string; type: string }[];
  'service-desc'?: { href: string; type: string }[];
  'service-meta'?: { href: string; type: string }[];
};

export const buildApiCatalog = (
  baseUrl: string,
  helpUrl: string | null,
): { linkset: ApiCatalogLink[] } => {
  const serviceDoc: { 'service-doc'?: { href: string; type: string }[] } =
    helpUrl === null
      ? {}
      : { 'service-doc': [{ href: helpUrl, type: 'text/html' }] };

  const linkset: ApiCatalogLink[] = [
      {
        anchor: `${baseUrl}/${ApiPath.Rest}`,
        'service-desc': [
          {
            href: `${baseUrl}/${ApiPath.Rest}/open-api/core`,
            type: 'application/json',
          },
        ],
        ...serviceDoc,
        'service-meta': [
          {
            href: `${baseUrl}/${ApiPath.WellKnown}/oauth-protected-resource`,
            type: 'application/json',
          },
        ],
      },
      {
        anchor: `${baseUrl}/${ApiPath.Rest}/metadata`,
        'service-desc': [
          {
            href: `${baseUrl}/${ApiPath.Rest}/open-api/metadata`,
            type: 'application/json',
          },
        ],
        ...serviceDoc,
      },
      {
        anchor: `${baseUrl}/${ApiPath.GraphQL}`,
        ...serviceDoc,
      },
      {
        anchor: `${baseUrl}/${ApiPath.Mcp}`,
        'service-desc': [
          {
            href: `${baseUrl}/${ApiPath.WellKnown}/mcp/server-card.json`,
            type: 'application/json',
          },
        ],
        ...serviceDoc,
      },
    ];

  return { linkset };
};
