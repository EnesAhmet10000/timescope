/**
 * Foreground-window detection via Win32 APIs (user32/kernel32) through koffi
 * FFI. Collects only: executable name/path and (optionally) window title.
 * No keystrokes, no clipboard, no screenshots, no page content.
 */
import path from 'node:path';

export interface ForegroundInfo {
  exeName: string; // lowercase basename without .exe
  exePath: string | null;
  title: string;
}

interface Win32Api {
  GetForegroundWindow: () => unknown;
  GetWindowTextW: (hwnd: unknown, buf: Buffer, max: number) => number;
  GetWindowThreadProcessId: (hwnd: unknown, out: Buffer) => number;
  OpenProcess: (access: number, inherit: boolean, pid: number) => unknown;
  QueryFullProcessImageNameW: (h: unknown, flags: number, buf: Buffer, size: Buffer) => boolean;
  CloseHandle: (h: unknown) => boolean;
  IsWindowVisible: (hwnd: unknown) => boolean;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

let api: Win32Api | null = null;
let loadError: Error | null = null;

function loadApi(): Win32Api | null {
  if (api || loadError) return api;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi');
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');
    api = {
      GetForegroundWindow: user32.func('__stdcall', 'GetForegroundWindow', 'void *', []),
      GetWindowTextW: user32.func('__stdcall', 'GetWindowTextW', 'int', ['void *', 'void *', 'int']),
      GetWindowThreadProcessId: user32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32', ['void *', 'void *']),
      IsWindowVisible: user32.func('__stdcall', 'IsWindowVisible', 'bool', ['void *']),
      OpenProcess: kernel32.func('__stdcall', 'OpenProcess', 'void *', ['uint32', 'bool', 'uint32']),
      QueryFullProcessImageNameW: kernel32.func('__stdcall', 'QueryFullProcessImageNameW', 'bool', [
        'void *',
        'uint32',
        'void *',
        'void *',
      ]),
      CloseHandle: kernel32.func('__stdcall', 'CloseHandle', 'bool', ['void *']),
    };
    return api;
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err));
    console.error('[win32] failed to load koffi bindings:', loadError.message);
    return null;
  }
}

function utf16BufferToString(buf: Buffer): string {
  const s = buf.toString('utf16le');
  const nul = s.indexOf('\0');
  return nul >= 0 ? s.slice(0, nul) : s;
}

/** Returns info about the current foreground window, or null if none / lookup failed. */
export function getForegroundInfo(): ForegroundInfo | null {
  const w = loadApi();
  if (!w) return null;
  try {
    const hwnd = w.GetForegroundWindow();
    if (!hwnd) return null;

    const pidBuf = Buffer.alloc(4);
    w.GetWindowThreadProcessId(hwnd, pidBuf);
    const pid = pidBuf.readUInt32LE(0);
    if (pid === 0) return null;

    let exePath: string | null = null;
    const hProc = w.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    if (hProc) {
      try {
        const pathBuf = Buffer.alloc(1024 * 2);
        const sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32LE(1024, 0);
        if (w.QueryFullProcessImageNameW(hProc, 0, pathBuf, sizeBuf)) {
          exePath = utf16BufferToString(pathBuf);
        }
      } finally {
        w.CloseHandle(hProc);
      }
    }
    if (!exePath) return null;

    const titleBuf = Buffer.alloc(512 * 2);
    w.GetWindowTextW(hwnd, titleBuf, 512);
    const title = utf16BufferToString(titleBuf);

    const exeName = path.basename(exePath).replace(/\.exe$/i, '').toLowerCase();
    if (!exeName) return null;
    return { exeName, exePath, title };
  } catch (err) {
    console.error('[win32] getForegroundInfo failed:', err);
    return null;
  }
}
