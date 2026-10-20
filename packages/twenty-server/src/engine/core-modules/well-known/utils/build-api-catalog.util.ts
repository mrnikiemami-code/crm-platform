import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';
import { ApiPath } from 'twenty-shared/types';

// service-desc points at each host's live OpenAPI, which is generated per
// workspace and so includes that workspace's custom objects.
//
// service-doc links are same-origin help URLs built from the installation's
// published baseUrl — never from Host headers, request bodies, or docs.twenty.com.
export const buildApiCatalog = (baseUrl: string) => {
  const helpDocUrl = `${baseUrl.replace(/\/$/, '')}${HELP_CENTER_BASE_PATH}`;

  return {
    linkset: [
      {
        anchor: `${baseUrl}/${ApiPath.Rest}`,
        'service-desc': [
          {
            href: `${baseUrl}/${ApiPath.Rest}/open-api/core`,
            type: 'application/json',
          },
        ],
        'service-doc': [{ href: helpDocUrl, type: 'text/html' }],
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
        'service-doc': [{ href: helpDocUrl, type: 'text/html' }],
      },
      {
        anchor: `${baseUrl}/${ApiPath.GraphQL}`,
        'service-doc': [{ href: helpDocUrl, type: 'text/html' }],
      },
      {
        anchor: `${baseUrl}/${ApiPath.Mcp}`,
        'service-desc': [
          {
            href: `${baseUrl}/${ApiPath.WellKnown}/mcp/server-card.json`,
            type: 'application/json',
          },
        ],
        'service-doc': [{ href: helpDocUrl, type: 'text/html' }],
      },
    ],
  };
};
