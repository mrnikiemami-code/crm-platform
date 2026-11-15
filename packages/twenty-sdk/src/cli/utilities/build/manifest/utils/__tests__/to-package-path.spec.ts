import { sep } from 'path';

import {
  toPackagePath,
  toRelativePackagePath,
} from '@/cli/utilities/build/manifest/utils/to-package-path';

// A manifest path is read by the installer INSIDE the published archive, so it
// has to be a POSIX path regardless of the machine that built the app. These
// cases feed both separators explicitly, so the guarantee does not depend on
// which platform runs the suite.
describe('toPackagePath', () => {
  it('leaves a POSIX path untouched', () => {
    expect(toPackagePath('src/logic-functions/save.mjs')).toBe(
      'src/logic-functions/save.mjs',
    );
  });

  it('rewrites Windows separators as POSIX ones', () => {
    expect(toPackagePath('src\\logic-functions\\save.mjs')).toBe(
      'src/logic-functions/save.mjs',
    );
  });

  it('handles a mixed separator path', () => {
    expect(toPackagePath('src\\components/card.front-component.mjs')).toBe(
      'src/components/card.front-component.mjs',
    );
  });

  it('leaves a bare file name alone', () => {
    expect(toPackagePath('save.mjs')).toBe('save.mjs');
  });

  it('produces an idempotent result', () => {
    const once = toPackagePath('src\\a\\b.mjs');

    expect(toPackagePath(once)).toBe(once);
  });

  it('uses the separator of the running platform for its own input', () => {
    // Built with the platform's own join, which is what `relative` hands over.
    const hostPath = ['src', 'fields', 'card.field.ts'].join(sep);

    expect(toPackagePath(hostPath)).toBe('src/fields/card.field.ts');
  });
});

describe('toRelativePackagePath', () => {
  it('measures from the app root and normalises in one step', () => {
    const appPath = ['C:', 'apps', 'demo'].join(sep);
    const filePath = ['C:', 'apps', 'demo', 'src', 'logic-functions', 'save.ts'].join(sep);

    expect(toRelativePackagePath({ appPath, filePath })).toBe(
      'src/logic-functions/save.ts',
    );
  });
});
