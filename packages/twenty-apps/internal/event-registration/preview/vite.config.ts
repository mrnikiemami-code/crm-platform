import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

// Local preview harness for the registration form.
//
// It is NOT an installation: nothing is written to the workspace metadata, no
// command menu item is registered, and the Dev server is only read. The session
// token stays in this Node process; the browser never receives it.

const here = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));

const TOKEN_FILE = process.env.PREVIEW_TOKEN_FILE ?? '';
const DEV_PORT = 3002;

const readToken = (): string => readFileSync(TOKEN_FILE, 'utf8').trim();

// Forwards GraphQL bodies to Dev with the user's own session token attached.
const graphqlProxy = (): Plugin => ({
  name: 'preview-graphql-proxy',
  configureServer(server) {
    server.middlewares.use('/api/graphql', (incoming, response) => {
      if (incoming.method !== 'POST') {
        response.statusCode = 405;
        response.end('POST only');

        return;
      }

      let body = '';
      incoming.on('data', (chunk) => {
        body += chunk;
      });
      incoming.on('end', () => {
        const upstream = httpRequest(
          {
            hostname: 'localhost',
            port: DEV_PORT,
            path: '/graphql',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              Authorization: `Bearer ${readToken()}`,
            },
          },
          (upstreamResponse) => {
            response.statusCode = upstreamResponse.statusCode ?? 502;
            response.setHeader('Content-Type', 'application/json');
            upstreamResponse.pipe(response);
          },
        );

        upstream.on('error', (error) => {
          response.statusCode = 502;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ errors: [{ message: String(error) }] }));
        });

        upstream.write(body);
        upstream.end();
      });
    });
  },
});

export default defineConfig({
  root: here('.'),
  plugins: [graphqlProxy()],
  define: {
    // The app's data layer reads these at call time; pointing them at the local
    // proxy is what keeps the real code path intact without a token in the tab.
    'process.env.TWENTY_API_URL': JSON.stringify('http://localhost:5177/api'),
    'process.env.TWENTY_APP_ACCESS_TOKEN': JSON.stringify('preview-proxy'),
  },
  resolve: {
    // Array form with anchored patterns on purpose: a plain `src` alias is a
    // PREFIX match, so it would swallow `src/components/registration-api` before
    // the override below could apply.
    alias: [
      {
        find: /^src\/components\/registration-api$/,
        replacement: here('./preview-api.ts'),
      },
      {
        find: /^twenty-sdk\/front-component$/,
        replacement: here('./host-shim.tsx'),
      },
      { find: /^src\//, replacement: `${here('../src/')}/`, },
    ],
  },
  server: {
    port: 5177,
    strictPort: true,
    fs: { allow: [here('../../../..')] },
  },
});
