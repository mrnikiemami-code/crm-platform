import http from 'node:http';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || process.argv[2] || 3000);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mainJsPath = join(packageRoot, 'dist/main.js');
// Verified Nest/SWC emit path for src/queue-worker/queue-worker.ts
const workerJsPath = join(packageRoot, 'dist/queue-worker/queue-worker.js');

// A legitimate cold `yarn start` has two slow phases, so readiness is tracked
// in two phases instead of one flat deadline (which previously timed out at
// 300s and let `concurrently --kill-others` tear down a healthy backend):
//
//   COLD-COMPILE  - on a first (cold) boot every source file is compiled and
//     the dist entrypoints are only emitted once that finishes. This is the
//     part that used to exceed the old flat deadline, so this window is
//     generous on purpose.
//
//   POST-COMPILE  - once the entrypoints exist, the app is booting (database
//     migrations + Nest init) before /healthz responds. This is a bounded,
//     shorter window, so a backend that has compiled but never becomes ready
//     is treated as a genuine startup failure instead of waited on.
//
// Neither window is infinite, so real startup errors are never hidden. A
// backend that crashes outright is torn down independently by the sibling
// `nx run-many` branch exiting under `concurrently --kill-others`; this
// script only needs to decide "healthy & ready" vs "give up". A machine with
// a very slow disk can widen the windows via env overrides.
const COLD_COMPILE_TIMEOUT_MS = 600_000;
const POST_COMPILE_READY_TIMEOUT_MS = 300_000;

const coldCompileTimeoutMs =
  Number(process.env.TWENTY_DEV_COMPILE_TIMEOUT_MS) || COLD_COMPILE_TIMEOUT_MS;
const postCompileReadyTimeoutMs =
  Number(process.env.TWENTY_DEV_READY_TIMEOUT_MS) ||
  POST_COMPILE_READY_TIMEOUT_MS;

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

// Require a down→up transition so a stale listener + leftover dist cannot be
// mistaken for a fresh boot and release the worker prematurely.
let hasSeenHttpDown = false;
// A "settled" compile is one whose entrypoints were observed to be emitted
// fresh in THIS run (they went absent→present, e.g. `rimraf dist` cleared a
// stale build and the new compile re-emitted them). Latching only on this
// transition makes the phase boundary immune to a leftover stale dist that
// happens to exist when this script starts.
let entrypointWasAbsent = false;
let compileSettledAt = null;

const coldCompileDeadline = Date.now() + coldCompileTimeoutMs;

while (true) {
  const entrypointExists =
    (await pathExists(mainJsPath)) && (await pathExists(workerJsPath));

  if (!entrypointExists) {
    entrypointWasAbsent = true;
  } else if (compileSettledAt === null && entrypointWasAbsent) {
    compileSettledAt = Date.now();
  }

  const httpReady = await isHttpReady();

  if (!httpReady) {
    hasSeenHttpDown = true;
  }

  // Ready = a fresh server came up (down→up) and the dist entrypoints exist.
  if (hasSeenHttpDown && httpReady && entrypointExists) {
    process.exit(0);
  }

  const effectiveDeadline =
    compileSettledAt === null
      ? coldCompileDeadline
      : compileSettledAt + postCompileReadyTimeoutMs;

  if (Date.now() >= effectiveDeadline) {
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
}

const phase =
  compileSettledAt === null ? 'cold-compile' : 'post-compile-readiness';

throw new Error(
  `Timed out waiting for twenty-server to be ready (${phase} phase). ` +
    `Expected dist entrypoints and http://127.0.0.1:${port}/healthz.`,
);
