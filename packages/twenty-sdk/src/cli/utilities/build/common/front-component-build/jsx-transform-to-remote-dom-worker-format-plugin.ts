import type * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';

import { unwrapDefineFrontComponentToDirectExport } from './utils/unwrap-define-front-component-to-direct-export';

export const jsxTransformToRemoteDomWorkerFormatPlugin: esbuild.Plugin = {
  name: 'jsx-transform-to-remote-dom-worker-format-plugin',
  setup: (esbuildBuild) => {
    esbuildBuild.onLoad(
      // Quotation (and other) apps author entrypoints as `*.front-component.ts`;
      // without `.ts` the unwrap never runs and `default` stays a ValidationResult.
      { filter: /\.tsx?$/ },

      async ({ path }): Promise<esbuild.OnLoadResult> => {
        try {
          const frontComponentSourceCode = await readFile(path, 'utf8');

          const transformedContents = unwrapDefineFrontComponentToDirectExport(
            frontComponentSourceCode,
          );

          return { contents: transformedContents, loader: 'tsx' };
        } catch (transformError) {
          return {
            errors: [
              {
                text: `Failed to transform front component: ${transformError instanceof Error ? transformError.message : String(transformError)}`,
                location: { file: path },
              },
            ],
          };
        }
      },
    );
  },
};
