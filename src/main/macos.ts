/**
 * Active-app detection on macOS.
 *
 * The bundled helper uses NSWorkspace for the frontmost application. Window
 * titles come from WindowServer when macOS allows it; their absence never
 * prevents application tracking (Screen Recording permission is optional).
 */
import { app } from 'electron';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { ForegroundInfo } from './foreground';

interface HelperResult {
  bundleId?: unknown;
  executablePath?: unknown;
  title?: unknown;
}

function helperPath(): string {
  const root = app.isPackaged ? process.resourcesPath : app.getAppPath();
  return path.join(root, 'assets', 'macos', 'TimeScopeForeground');
}

export function getForegroundInfo(): ForegroundInfo | null {
  try {
    const raw = execFileSync(helperPath(), [], {
      encoding: 'utf8',
      timeout: 1_500,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!raw) return null;
    const result = JSON.parse(raw) as HelperResult;
    const bundleId = typeof result.bundleId === 'string' ? result.bundleId.trim().toLowerCase() : '';
    const executablePath = typeof result.executablePath === 'string' ? result.executablePath : null;
    const fallback = executablePath ? path.basename(executablePath).toLowerCase() : '';
    const exeName = bundleId || fallback;
    if (!exeName) return null;
    return {
      exeName,
      exePath: executablePath,
      title: typeof result.title === 'string' ? result.title : '',
    };
  } catch (err) {
    // The tracker will retry at the next poll; do not expose helper failures to
    // the renderer or turn an intermittent lookup failure into an app crash.
    console.error('[macos] foreground lookup failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
