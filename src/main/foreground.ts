/** Cross-platform foreground application lookup used by the tracker. */
import { getForegroundInfo as getWindowsForegroundInfo } from './win32';
import { getForegroundInfo as getMacForegroundInfo } from './macos';

export interface ForegroundInfo {
  /** Stable, lowercase app identifier (bundle ID on macOS, executable name on Windows). */
  exeName: string;
  exePath: string | null;
  title: string;
}

export function getForegroundInfo(): ForegroundInfo | null {
  if (process.platform === 'darwin') return getMacForegroundInfo();
  if (process.platform === 'win32') return getWindowsForegroundInfo();
  return null;
}
