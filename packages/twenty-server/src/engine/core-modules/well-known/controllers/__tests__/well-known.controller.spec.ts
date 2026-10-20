import { Test, type TestingModule } from '@nestjs/testing';

import { type Request } from 'express';

import { WellKnownController } from 'src/engine/core-modules/well-known/controllers/well-known.controller';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

describe('WellKnownController', () => {
  let controller: WellKnownController;
  const configGet = jest.fn();

  const buildMockRequest = (host: string, protocol = 'https') =>
    ({
      protocol,
      get: (header: string) =>
        header.toLowerCase() === 'host' ? host : undefined,
    }) as unknown as Request;

  beforeEach(async () => {
    configGet.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WellKnownController],
      providers: [
        {
          provide: TwentyConfigService,
          useValue: { get: configGet },
        },
      ],
    }).compile();

    controller = module.get(WellKnownController);
  });

  describe('getMcpServerCard', () => {
    it('builds the card for the request host', () => {
      configGet.mockReturnValue('1.2.3');

      const card = controller.getMcpServerCard(
        buildMockRequest('workspace.twenty.com'),
      );

      expect(card.remotes[0].url).toBe('https://workspace.twenty.com/mcp');
      expect(card.version).toBe('1.2.3');
    });

    it('falls back to 0.0.0 when APP_VERSION is unset', () => {
      configGet.mockReturnValue(undefined);

      const card = controller.getMcpServerCard(
        buildMockRequest('workspace.twenty.com'),
      );

      expect(card.version).toBe('0.0.0');
    });
  });

  describe('getApiCatalog', () => {
    const configReturning =
      (values: Record<string, string | undefined>) => (key: string) =>
        values[key];

    it('returns a parseable linkset anchored on the request host', () => {
      configGet.mockImplementation(configReturning({}));

      const body = controller.getApiCatalog(
        buildMockRequest('workspace.twenty.com'),
      );

      const parsed = JSON.parse(body);

      expect(
        parsed.linkset.map((entry: { anchor: string }) => entry.anchor),
      ).toContain('https://workspace.twenty.com/rest');
    });

    it('respects the forwarded protocol', () => {
      configGet.mockImplementation(configReturning({}));

      const body = controller.getApiCatalog(
        buildMockRequest('localhost:3000', 'http'),
      );

      expect(JSON.parse(body).linkset[0].anchor).toBe(
        'http://localhost:3000/rest',
      );
    });

    it('never derives the help origin from a hostile Host header', () => {
      configGet.mockImplementation(
        configReturning({ SERVER_URL: 'https://api.customer.example' }),
      );

      const body = controller.getApiCatalog(
        buildMockRequest('attacker.example', 'https'),
      );

      for (const entry of JSON.parse(body).linkset) {
        expect(entry['service-doc'][0].href).toBe(
          'https://api.customer.example/help',
        );
        // The API anchor follows the serving host; only Help is off-limits.
        expect(entry.anchor.startsWith('https://attacker.example')).toBe(true);
      }
    });

    it('points help at the front origin when API and front are split', () => {
      configGet.mockImplementation(
        configReturning({
          FRONTEND_URL: 'https://app.customer.example',
          SERVER_URL: 'https://api.customer.example',
        }),
      );

      const body = controller.getApiCatalog(
        buildMockRequest('api.customer.example'),
      );

      for (const entry of JSON.parse(body).linkset) {
        expect(entry.anchor.startsWith('https://api.customer.example')).toBe(
          true,
        );
        expect(entry['service-doc'][0].href).toBe(
          'https://app.customer.example/help',
        );
      }
    });

    it('omits help links when no valid published origin is configured', () => {
      configGet.mockImplementation(
        configReturning({ FRONTEND_URL: 'not-a-url', SERVER_URL: '' }),
      );

      const body = controller.getApiCatalog(
        buildMockRequest('workspace.twenty.com'),
      );

      expect(JSON.parse(body).linkset[0]['service-doc']).toBeUndefined();
      expect(body).not.toContain('/help');
    });
  });
});
