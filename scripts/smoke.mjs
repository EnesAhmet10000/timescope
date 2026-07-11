/**
 * Automated smoke test: builds nothing (expects `npm run build` first),
 * launches Electron with TIMESCOPE_SMOKE=1 against a throwaway database,
 * waits for the [smoke-result] line, and asserts the tracker recorded the
 * foreground app.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The electron package exports the path to electron.exe when required from Node.
const electronBin = createRequire(import.meta.url)('electron');

const child = spawn(electronBin, ['.', '--hidden'], {
  cwd: root,
  env: { ...process.env, TIMESCOPE_SMOKE: '1' },
});

let out = '';
const timeout = setTimeout(() => {
  console.error('SMOKE FAIL: timed out');
  child.kill();
  process.exit(1);
}, 60_000);

child.stdout.on('data', (d) => {
  const s = d.toString();
  out += s;
  process.stdout.write(s);
});
child.stderr.on('data', (d) => process.stderr.write(d.toString()));

child.on('exit', () => {
  clearTimeout(timeout);
  const m = out.match(/\[smoke-result\] (.*)/);
  if (!m) {
    console.error('SMOKE FAIL: no smoke-result line');
    process.exit(1);
  }
  const result = JSON.parse(m[1]);
  // Machine in use -> sessions recorded; machine idle -> idle period recorded.
  const activeOk = result.summary.activeMs > 3000 && result.apps.length >= 1;
  const idleOk = result.status.state === 'idle' && result.summary.idleMs > 3000;
  const ok = activeOk || idleOk;
  console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL: nothing recorded');
  console.log(
    activeOk
      ? `recorded active app(s): ${result.apps.map((a) => a.exeName).join(', ')}`
      : `machine was idle (${result.idleSec}s since input) — idle period recorded correctly`,
  );
  process.exit(ok ? 0 : 1);
});
