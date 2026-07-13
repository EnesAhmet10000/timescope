/** Typed wrapper around the preload bridge. */
import type { IpcApi, IpcChannel, Range } from '../shared/types';

declare global {
  interface Window {
    timescope: {
      invoke(channel: string, payload?: unknown): Promise<unknown>;
      onStateChanged(cb: () => void): () => void;
      onUpdateEvent(cb: (info: unknown) => void): () => void;
    };
  }
}

export function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcApi[C]['req'] extends void ? [] : [IpcApi[C]['req']]
): Promise<IpcApi[C]['res']> {
  return window.timescope.invoke(channel, args[0]) as Promise<IpcApi[C]['res']>;
}

export function onStateChanged(cb: () => void): () => void {
  return window.timescope.onStateChanged(cb);
}

export function onUpdateEvent(cb: (info: unknown) => void): () => void {
  return window.timescope.onUpdateEvent(cb);
}

// ---------- date/range helpers ----------

export type View = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getRange(view: View, custom?: { from: number; to: number }): Range {
  const now = Date.now();
  const today = startOfDay(now);
  const DAY = 86_400_000;
  switch (view) {
    case 'today':
      return { from: today, to: now };
    case 'yesterday':
      return { from: today - DAY, to: today };
    case '7d':
      return { from: today - 6 * DAY, to: now };
    case '30d':
      return { from: today - 29 * DAY, to: now };
    case 'custom':
      return custom ?? { from: today, to: now };
  }
}

export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return ms >= 1000 ? `${Math.round(ms / 1000)}s` : '0m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInputValue(v: string): number {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}
