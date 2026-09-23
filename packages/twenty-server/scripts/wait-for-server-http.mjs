import http from 'node:http';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || process.argv[2] || 3000);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mainJsPath = join(packageRoot, 'dist/main.js');
// Verified Nest/SWC emit path for src/queue-worker/queue-worker.ts
const workerJsPath = join(packageRoot, 'dist/queue-worker/queue-worker.js');
const deadline = Date.now() + 300_000;

const pathExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const isHttpReady = () =>
  new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/healthz`, (response) => {
      response.resume();
      // healthz may return 401; any HTTP response means Nest is listening
      resolve(true);
    });

    request.on('error', () => resolve(false));
  });

// Require a down→up transition so a stale listener + leftover dist cannot
// release the worker before `rimraf dist` in twenty-server:start.
let hasSeenHttpDown = false;

while (Date.now() < deadline) {
  const httpReady = await isHttpReady();

  if (!httpReady) {
    hasSeenHttpDown = true;
  }

  if (
    hasSeenHttpDown &&
    httpReady &&
    (await pathExists(mainJsPath)) &&
    (await pathExists(workerJsPath))
  ) {
    process.exit(0);
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
}

throw new Error(
  `Timed out waiting for twenty-server dist entrypoints and http://127.0.0.1:${port}/healthz`,
);
