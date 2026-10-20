import {
  resolvePublishedHelpOrigin,
  resolvePublishedHelpUrl,
} from 'src/engine/core-modules/well-known/utils/resolve-published-help-url.util';

describe('resolvePublishedHelpUrl', () => {
  it('prefers the published front origin when both are configured', () => {
    expect(
      resolvePublishedHelpUrl({
        frontendUrl: 'https://app.customer.example',
        serverUrl: 'https://api.customer.example',
      }),
    ).toBe('https://app.customer.example/help');
  });

  it('falls back to the server origin for single-origin installations', () => {
    expect(resolvePublishedHelpUrl({ serverUrl: 'http://localhost:3000' })).toBe(
      'http://localhost:3000/help',
    );
  });

  it('normalises trailing paths and slashes down to the origin', () => {
    expect(
      resolvePublishedHelpOrigin({
        frontendUrl: 'https://app.customer.example/some/path/',
      }),
    ).toBe('https://app.customer.example');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['relative', '/help'],
    ['host-only', 'app.customer.example'],
    ['non-http protocol', 'ftp://app.customer.example'],
    ['javascript protocol', 'javascript:alert(1)'],
    ['credentials', 'https://user:secret@app.customer.example'],
  ])('returns null for a %s origin', (_label, value) => {
    expect(resolvePublishedHelpUrl({ frontendUrl: value as string })).toBeNull();
  });

  it('ignores an invalid front origin and uses a valid server origin', () => {
    expect(
      resolvePublishedHelpUrl({
        frontendUrl: 'not-a-url',
        serverUrl: 'https://crm.example.com',
      }),
    ).toBe('https://crm.example.com/help');
  });
});
