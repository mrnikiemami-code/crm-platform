import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Source-contract guard for the studio route: the preview action must reuse the
// existing READ-ONLY preview service and must never touch a send or persistence
// path. This locks the guarantee that previewing cannot send an SMS, create a
// Communication, write a timeline activity or modify the saved template.
const ROUTE_SOURCE = readFileSync(
  join(__dirname, '..', '..', 'logic-functions', 'template-studio.ts'),
  'utf8',
);

describe('template studio route contract', () => {
  it('reuses the production read-only preview service', () => {
    expect(ROUTE_SOURCE).toContain(
      "import { previewTemplate } from 'src/templates/preview-template.service'",
    );
    expect(ROUTE_SOURCE).toContain('await previewTemplate({');
  });

  it('never imports a send or persistence path', () => {
    for (const forbidden of [
      'communication-send',
      'CommunicationSendService',
      'CommunicationSendAndPersistService',
      'communication-persistence',
      'CoreApiCommunicationPersistence',
      'CommunicationSendService',
      '/communication/send',
    ]) {
      expect(ROUTE_SOURCE).not.toContain(forbidden);
    }
  });

  it('reports failures only with the stable application-owned codes', () => {
    // No raw exception text is ever assembled into a response. The comment
    // block above the handler mentions the pattern by name, so strip comments
    // before asserting that no CODE reads exception text.
    const withoutComments = ROUTE_SOURCE.replace(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
      '',
    );

    expect(withoutComments).not.toContain('error.message');
    expect(withoutComments).not.toContain('String(error)');
    expect(withoutComments).not.toContain('JSON.stringify(error)');
  });

  it('builds the field catalog server-side, never from the request', () => {
    expect(ROUTE_SOURCE).toContain('buildAuthorizedTemplateCatalog');
    expect(ROUTE_SOURCE).toContain('findMessageTemplates');
  });
});
