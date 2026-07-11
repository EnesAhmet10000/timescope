/**
 * Dev workflow: esbuild (watch) for main/preload + Vite dev server for the
 * renderer + Electron pointed at the dev server.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Build main/preload once, then watch.
const esbuild = spawn(process.execPath, [path.join(root, 'scripts/build-main.mjs'), '--watch'], {
  cwd: root,
  stdio: 'inherit',
});

// 2. Vite dev server.
const vite = await createServer({ configFile: path.join(root, 'vite.config.ts') });
await vite.listen();
const url = `http://localhost:${vite.config.server.port}`;
console.log(`[dev] renderer at ${url}`);

// Give esbuild a moment to produce dist/main on first run.
await new Promise((r) => setTimeout(r, 1500));

// 3. Electron.
const { createRequire } = await import('node:module');
const electronBin = createRequire(import.meta.url)('electron');
const electron = spawn(electronBin, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});

electron.on('exit', async (code) => {
  esbuild.kill();
  await vite.close();
  process.exit(code ?? 0);
});
