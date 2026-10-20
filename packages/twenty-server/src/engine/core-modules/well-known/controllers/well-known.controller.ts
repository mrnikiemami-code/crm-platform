import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';

import { type Request } from 'express';
import { ApiPath } from 'twenty-shared/types';

import { buildApiCatalog } from 'src/engine/core-modules/well-known/utils/build-api-catalog.util';
import { buildMcpServerCard } from 'src/engine/core-modules/well-known/utils/build-mcp-server-card.util';
import { resolvePublishedHelpUrl } from 'src/engine/core-modules/well-known/utils/resolve-published-help-url.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { getRequestBaseUrl } from 'src/utils/get-request-base-url.util';
import { extractVersionMajorMinorPatch } from 'src/utils/version/extract-version-major-minor-patch';

const DISCOVERY_CACHE_CONTROL = 'public, max-age=3600';
const FALLBACK_SERVER_VERSION = '0.0.0';

@Controller(ApiPath.WellKnown)
export class WellKnownController {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  @Get('mcp/server-card.json')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @Header('Cache-Control', DISCOVERY_CACHE_CONTROL)
  getMcpServerCard(@Req() request: Request) {
    const version =
      extractVersionMajorMinorPatch(
        this.twentyConfigService.get('APP_VERSION'),
      ) ?? FALLBACK_SERVER_VERSION;

    return buildMcpServerCard({
      baseUrl: getRequestBaseUrl(request),
      version,
    });
  }

  // Return a string so Nest keeps the explicit linkset+json Content-Type.
  @Get('api-catalog')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @Header(
    'Content-Type',
    'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
  )
  @Header('Cache-Control', DISCOVERY_CACHE_CONTROL)
  getApiCatalog(@Req() request: Request): string {
    // API anchors/descriptors follow the host that serves them; the help link
    // follows validated installation configuration, so a spoofed Host cannot
    // redirect readers and a split API/front deployment points at the UI.
    const helpUrl = resolvePublishedHelpUrl({
      frontendUrl: this.twentyConfigService.get('FRONTEND_URL'),
      serverUrl: this.twentyConfigService.get('SERVER_URL'),
    });

    return JSON.stringify(
      buildApiCatalog(getRequestBaseUrl(request), helpUrl),
      null,
      2,
    );
  }
}
