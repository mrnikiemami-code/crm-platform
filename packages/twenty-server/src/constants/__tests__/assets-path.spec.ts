import path from 'path';

import {
  ASSET_PATH,
  isBuiltThroughTestingModule,
  resolveAssetPath,
} from 'src/constants/assets-path';

// Normalize to forward slashes so suffix assertions are readable on any platform.
const toPosix = (filePath: string): string =>
  filePath.split(path.sep).join('/');

describe('assets-path', () => {
  describe('isBuiltThroughTestingModule', () => {
    it('detects the dist build on a POSIX path (forward slashes)', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/dist/constants',
        ),
      ).toBe(false);
    });

    it('detects the dist build on a Windows path (backslashes)', () => {
      expect(
        isBuiltThroughTestingModule(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\dist\\constants',
        ),
      ).toBe(false);
    });

    it('treats a source/testing path as not built (POSIX)', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/constants',
        ),
      ).toBe(true);
    });

    it('treats a source/testing path as not built (Windows)', () => {
      expect(
        isBuiltThroughTestingModule(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\src\\constants',
        ),
      ).toBe(true);
    });

    it('does not match a bare "dist" segment without surrounding slashes', () => {
      // A trailing folder named `dist` (no closing slash) is not a build path.
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/constants/dist',
        ),
      ).toBe(true);
    });

    it('does not match a folder whose name merely contains "dist"', () => {
      expect(
        isBuiltThroughTestingModule(
          '/app/packages/twenty-server/src/distribution/constants',
        ),
      ).toBe(true);
    });
  });

  describe('resolveAssetPath', () => {
    // Assertions use normalized suffixes: an absolute POSIX input resolved on a
    // Windows host gains a drive prefix, so exact string equality would test the
    // host platform rather than the module's logic.
    it('appends the assets segment when built, regardless of separators', () => {
      const posixInput = toPosix(
        resolveAssetPath('/app/packages/twenty-server/dist/constants'),
      );
      const windowsInput = toPosix(
        resolveAssetPath(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\dist\\constants',
        ),
      );

      expect(posixInput.endsWith('/dist/assets')).toBe(true);
      expect(windowsInput.endsWith('/dist/assets')).toBe(true);
    });

    it('does not append the assets segment when running from source', () => {
      const posixInput = toPosix(
        resolveAssetPath('/app/packages/twenty-server/src/constants'),
      );
      const windowsInput = toPosix(
        resolveAssetPath(
          'D:\\CrmSource\\twenty\\packages\\twenty-server\\src\\constants',
        ),
      );

      expect(posixInput.endsWith('/src')).toBe(true);
      expect(posixInput.endsWith('/assets')).toBe(false);
      expect(windowsInput.endsWith('/src')).toBe(true);
      expect(windowsInput.endsWith('/assets')).toBe(false);
    });

    it('resolves the constants parent directory when running from source', () => {
      const resolved = toPosix(
        resolveAssetPath('/app/packages/twenty-server/src/constants'),
      );

      expect(resolved.endsWith('/twenty-server/src')).toBe(true);
    });
  });

  describe('ASSET_PATH (module-level export)', () => {
    it('follows the same rule as resolveAssetPath for the running directory', () => {
      // Under jest the module is compiled from src, so this asserts the exported
      // constant is consistent with the directory it was evaluated in.
      const isDist = __dirname.split(/[\\/]/).includes('dist');

      expect(toPosix(ASSET_PATH).endsWith('/assets')).toBe(isDist);
    });

    it('resolves next to the compiled constants directory when built', () => {
      if (!__dirname.split(/[\\/]/).includes('dist')) {
        return;
      }

      expect(ASSET_PATH).toBe(path.resolve(__dirname, '../assets'));
    });
  });
});
