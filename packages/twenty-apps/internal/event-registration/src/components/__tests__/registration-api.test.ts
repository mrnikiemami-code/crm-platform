import { describe, expect, it } from 'vitest';

import { resolveFunctionsBaseUrl } from 'src/components/registration-api';

// The supported public function URL always wins; the legacy `/s/` prefix is a
// last resort so an environment without domain configuration still works, and
// no host is ever hardcoded.
describe('resolveFunctionsBaseUrl', () => {
  it('prefers the platform public function URL', () => {
    expect(
      resolveFunctionsBaseUrl('https://acme.twenty.com', 'http://localhost:3002'),
    ).toBe('https://acme.twenty.com');
  });

  it('strips a trailing slash from the supported URL', () => {
    expect(resolveFunctionsBaseUrl('https://acme.twenty.com/', undefined)).toBe(
      'https://acme.twenty.com',
    );
  });

  it('falls back to the legacy prefix only when no public URL exists', () => {
    expect(resolveFunctionsBaseUrl(undefined, 'http://localhost:3002')).toBe(
      'http://localhost:3002/s',
    );
  });

  it('returns null when neither is configured', () => {
    const previousFunctions = process.env.TWENTY_FUNCTIONS_URL;
    const previousApi = process.env.TWENTY_API_URL;

    delete process.env.TWENTY_FUNCTIONS_URL;
    delete process.env.TWENTY_API_URL;

    try {
      expect(resolveFunctionsBaseUrl(undefined, undefined)).toBeNull();
    } finally {
      if (previousFunctions !== undefined) {
        process.env.TWENTY_FUNCTIONS_URL = previousFunctions;
      }
      if (previousApi !== undefined) {
        process.env.TWENTY_API_URL = previousApi;
      }
    }
  });

  it('treats an empty supported URL as absent', () => {
    expect(resolveFunctionsBaseUrl('   ', 'http://localhost:3002')).toBe(
      'http://localhost:3002/s',
    );
  });
});
