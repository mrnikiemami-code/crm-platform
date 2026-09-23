import { spawn } from 'node:child_process';
import { access, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const accessAsync = promisify(access);

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Nest/SWC (sourceRoot=src, outDir=dist) emits:
//   src/queue-worker/queue-worker.ts -> dist/queue-worker/queue-worker.js
const workerEntryPath = join(packageRoot, 'dist/queue-worker/queue-worker.js');
const distPath = join(packageRoot, 'dist');
const deadline = Date.now() + 300_000;

const pathExists = async (filePath) => {
  try {
    await accessAsync(filePath);
    return true;
  } catch {
    return false;
  }
};

const waitForWorkerEntry = async () => {
  if (await pathExists(workerEntryPath)) {
    return;
  }

  await new Promise((resolve, reject) => {
    const watchers = [];

    const cleanup = () => {
      for (const watcher of watchers) {
        watcher.close();
      }
    };

    const tryResolve = async () => {
      if (Date.now() > deadline) {
        cleanup();
        reject(
          new Error(
            `Timed out waiting for worker entry at ${workerEntryPath}`,
          ),
        );
        return;
      }

      if (await pathExists(workerEntryPath)) {
        cleanup();
        resolve();
      }
    };

    const watchDirectory = (directoryPath) => {
      watchers.push(
        watch(directoryPath, { recursive: true }, () => {
          void tryResolve();
        }),
      );
    };

    watchDirectory(packageRoot);

    void (async () => {
      if (await pathExists(distPath)) {
        watchDirectory(distPath);
      }
    })();

    void tryResolve();
  });
};

await waitForWorkerEntry();

const childProcess = spawn(process.execPath, ['--watch', workerEntryPath], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
});

const forwardSignal = (signal) => {
  if (childProcess.pid) {
    childProcess.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

childProcess.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
