/**
 * Minimal local file logger. Writes to <userData>/logs/timescope.log so that
 * crashes, tracker errors or resume glitches leave a diagnosable trail — the
 * log stays on this machine and contains no activity data, only app events.
 * The file is trimmed when it grows past MAX_BYTES to avoid unbounded growth.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 512 * 1024;

let logFile: string | null = null;

export function initLogger(userDataDir: string): void {
  try {
    const dir = path.join(userDataDir, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logFile = path.join(dir, 'timescope.log');
    trimIfNeeded();
    write('info', `--- TimeScope started (pid ${process.pid}) ---`);
  } catch {
    logFile = null; // logging must never crash the app
  }
}

export function logInfo(msg: string): void {
  write('info', msg);
}

export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : err ? String(err) : '';
  write('error', detail ? `${msg} ${detail}` : msg);
  console.error(msg, err ?? '');
}

function write(level: 'info' | 'error', msg: string): void {
  if (!logFile) return;
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} [${level}] ${msg}\n`);
  } catch {
    // ignore — never let logging failures propagate
  }
}

function trimIfNeeded(): void {
  if (!logFile) return;
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_BYTES) {
      const tail = fs.readFileSync(logFile, 'utf8').slice(-MAX_BYTES / 2);
      fs.writeFileSync(logFile, tail);
    }
  } catch {
    // ignore
  }
}

export function getLogFile(): string | null {
  return logFile;
}
