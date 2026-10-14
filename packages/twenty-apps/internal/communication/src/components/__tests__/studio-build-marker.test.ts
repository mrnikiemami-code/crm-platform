import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STUDIO_BUILD_MARKER } from 'src/components/template-studio.front-component';

// The studio shows its loaded revision in the header. That marker is only
// trustworthy if it cannot drift from the package it was built from, because a
// stale bundle and a broken bundle are otherwise indistinguishable to the user.
describe('studio build marker', () => {
  it('matches the package version exactly', () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version?: unknown };

    expect(packageJson.version).toBe(STUDIO_BUILD_MARKER);
  });

  it('is a plain semver string, not a label', () => {
    expect(STUDIO_BUILD_MARKER).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
