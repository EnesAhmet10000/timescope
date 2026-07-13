/** Build the tiny Cocoa helper that reports the foreground macOS application. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  console.log('[macos-helper] skipped (not running on macOS)');
  process.exit(0);
}

const outputDir = path.join(root, 'assets', 'macos');
fs.mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, 'TimeScopeForeground');
const moduleCache = path.join(root, '.cache', 'swift-modules', process.env.DEVELOPER_DIR ? 'selected-xcode' : 'active-xcode');
fs.mkdirSync(moduleCache, { recursive: true });
const swiftc = execFileSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' }).trim();
const sdk = execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' }).trim();
execFileSync(swiftc, ['-O', '-sdk', sdk, '-module-cache-path', moduleCache, path.join(root, 'src', 'macos', 'TimeScopeForeground.swift'), '-o', output], {
  stdio: 'inherit',
});
fs.chmodSync(output, 0o755);
console.log('built assets/macos/TimeScopeForeground');
