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

  it('derives the field catalog server-side, never from the request', () => {
    // The catalog is still built from the workspace's own metadata and the
    // caller's authorized read — no client-supplied list of field names is ever
    // trusted.
    expect(ROUTE_SOURCE).toContain('buildAuthorizedTemplateCatalog');
  });

  it('gates every data-touching action behind an authenticated USER', () => {
    // The authorization boundary must exist and must come from the platform's own
    // view of the request, never from the body: `event.userWorkspaceId` is set by
    // the route trigger from the validated token, so a client cannot forge it.
    expect(ROUTE_SOURCE).toContain('hasAuthenticatedUser');
    expect(ROUTE_SOURCE).toContain('event.userWorkspaceId');
    expect(ROUTE_SOURCE).toContain('AUTH_REQUIRED');

    // No body field may be consulted for identity.
    const withoutComments = ROUTE_SOURCE.replace(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
      '',
    );

    for (const forbidden of [
      'body.userId',
      'body.role',
      'body.userWorkspaceId',
      'requestUserId',
    ]) {
      expect(withoutComments).not.toContain(forbidden);
    }
  });

  it('refuses to reinterpret an unresolvable stored source as Person', () => {
    // The whole point of the stored-identifier model: a value that no longer
    // resolves is a mismatch, not a silent downgrade to Person.
    expect(ROUTE_SOURCE).toContain('resolveStoredTemplateSource');
    expect(ROUTE_SOURCE).toContain('CONTEXT_MISMATCH');
  });

  it('writes through the conditional batch update, not a check-then-write', () => {
    // A real compare-and-set: the decision and the write are one statement, so an
    // empty result is a conflict rather than a race.
    expect(ROUTE_SOURCE).toContain('saveMessageTemplateConditionally');
    expect(ROUTE_SOURCE).not.toContain('saveMessageTemplateBody');
  });

  it('no longer exposes the studio\'s own CRUD actions', () => {
    // Template CRUD belongs to the platform's native list and record page; a
    // second route to the same records would be an unaudited parallel path.
    for (const removed of [
      "action === 'list'",
      "action === 'create'",
      "action === 'update'",
      "action === 'delete'",
    ]) {
      expect(ROUTE_SOURCE).not.toContain(removed);
    }
  });
});
