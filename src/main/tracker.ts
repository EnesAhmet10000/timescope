/**
 * Automatic activity tracking engine.
 *
 * A poll runs every POLL_MS. Continuous focus on one app becomes a single
 * `sessions` row (grouped; brief alt-tabs away and back within MERGE_GAP_MS
 * are merged into the previous row to avoid duplicate-row explosion).
 * The open row's end_ts is persisted on every poll, so a crash or power
 * loss costs at most one poll interval of data — no dangling rows to repair.
 *
 * Idle, lock-screen, and system suspend all close the current session and
 * open an `idle_periods` row. Idle detection is retroactive: when the idle
 * threshold is reached, the session is truncated to when input actually
 * stopped, not when the threshold fired.
 *
 * Dependencies (clock, foreground window, idle seconds) are injected so the
 * whole state machine is unit-testable without Electron or Win32.
 */
import type { Db } from './db';
import type { Catalog } from './catalog';
import type { SettingsStore } from './settings';
import type { IdleKind, TrackingStatus } from '../shared/types';
import type { ForegroundInfo } from './foreground';

export const POLL_MS = 2000;
export const MERGE_GAP_MS = 5000;

export interface TrackerDeps {
  now: () => number;
  getForeground: () => ForegroundInfo | null;
  getIdleSec: () => number;
}

interface OpenSession {
  rowId: number;
  appId: number;
  exeName: string;
  title: string | null;
  startTs: number;
  lastSeenTs: number;
}

interface OpenIdle {
  rowId: number;
  kind: IdleKind;
  startTs: number;
}

export class Tracker {
  private session: OpenSession | null = null;
  private idle: OpenIdle | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Timestamp of the last poll tick — the heartbeat the watchdog checks. */
  private lastPollTs = 0;
  /** Called after each poll with the current foreground info (used by focus mode). */
  onActivity: ((info: ForegroundInfo | null) => void) | null = null;

  constructor(
    private db: Db,
    private catalog: Catalog,
    private settings: SettingsStore,
    private deps: TrackerDeps,
  ) {}

  start(): void {
    if (this.timer) return;
    this.lastPollTs = this.deps.now();
    this.timer = setInterval(() => this.safePoll(), POLL_MS);
    this.safePoll();
  }

  /**
   * Restart the poll loop if it is not running. Called on system resume/unlock
   * as a safety net so a missed timer can never leave tracking permanently off.
   */
  ensureRunning(): void {
    if (!this.timer) this.start();
  }

  /**
   * Force-recreate the poll timer unconditionally. Unlike ensureRunning(), this
   * also recovers a timer that still *exists* but has stopped firing — which can
   * happen after the OS freezes timers across sleep/modern-standby. The stored
   * handle stays non-null in that case, so only tearing it down and recreating
   * it revives tracking.
   */
  restartPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.start();
  }

  /** True while the poll loop handle exists — used by the health watchdog. */
  isRunning(): boolean {
    return this.timer !== null;
  }

  /** Milliseconds since the last poll tick. Large values mean a stalled loop. */
  msSinceLastPoll(now: number): number {
    return now - this.lastPollTs;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const now = this.deps.now();
    this.closeSession(now);
    this.closeIdle(now);
  }

  private safePoll(): void {
    this.lastPollTs = this.deps.now();
    try {
      this.poll();
    } catch (err) {
      console.error('[tracker] poll failed:', err);
    }
  }

  poll(): void {
    const s = this.settings.get();
    const now = this.deps.now();

    if (s.trackingPaused) {
      this.closeSession(now);
      this.closeIdle(now);
      return;
    }

    // Forced idle (lock screen / suspend) is normally cleared by the OS
    // resume/unlock event. Those events are occasionally missed — notably with
    // Windows "modern standby" sleep — which previously wedged tracking off
    // forever. Self-heal: if real input has returned, close the forced idle and
    // resume normal tracking instead of returning early on every poll.
    if (this.idle && this.idle.kind !== 'idle') {
      if (this.deps.getIdleSec() * 1000 < s.idleThresholdSec * 1000) {
        this.resumeFromForcedIdle();
      } else {
        this.db.run('UPDATE idle_periods SET end_ts = ? WHERE id = ?', [now, this.idle.rowId]);
        return;
      }
    }

    const idleSec = this.deps.getIdleSec();
    const idleMs = idleSec * 1000;

    if (this.idle) {
      if (idleMs < s.idleThresholdSec * 1000) {
        // User came back.
        this.closeIdle(now);
      } else {
        this.db.run('UPDATE idle_periods SET end_ts = ? WHERE id = ?', [now, this.idle.rowId]);
        return;
      }
    } else if (idleMs >= s.idleThresholdSec * 1000) {
      // Threshold crossed — input actually stopped idleMs ago.
      const idleStart = now - idleMs;
      this.closeSession(idleStart);
      this.openIdle('idle', idleStart, now);
      return;
    }

    const info = this.deps.getForeground();
    this.onActivity?.(info);

    if (!info || s.excludedApps.includes(info.exeName)) {
      this.closeSession(now);
      return;
    }

    const title = s.trackWindowTitles ? truncateTitle(info.title) : null;

    if (this.session && this.session.exeName === info.exeName) {
      this.session.lastSeenTs = now;
      if (title !== this.session.title) this.session.title = title;
      this.db.run('UPDATE sessions SET end_ts = ?, title = ? WHERE id = ?', [now, this.session.title, this.session.rowId]);
      return;
    }

    this.closeSession(now);
    this.openSession(info, title, now);
  }

  private openSession(info: ForegroundInfo, title: string | null, now: number): void {
    const appId = this.catalog.ensureApp(info.exeName, info.exePath);

    // Merge with the immediately preceding session of the same app if the
    // gap is tiny (quick alt-tab), instead of creating a near-duplicate row.
    const prev = this.db.get<{ id: number; start_ts: number; end_ts: number; title: string | null }>(
      'SELECT id, start_ts, end_ts, title FROM sessions WHERE app_id = ? ORDER BY end_ts DESC LIMIT 1',
      [appId],
    );
    if (prev && now - prev.end_ts >= 0 && now - prev.end_ts <= MERGE_GAP_MS) {
      this.session = {
        rowId: prev.id,
        appId,
        exeName: info.exeName,
        title: title ?? prev.title,
        startTs: prev.start_ts,
        lastSeenTs: now,
      };
      this.db.run('UPDATE sessions SET end_ts = ?, title = ? WHERE id = ?', [now, this.session.title, prev.id]);
      return;
    }

    const { lastInsertRowid } = this.db.run(
      'INSERT INTO sessions (app_id, title, start_ts, end_ts) VALUES (?, ?, ?, ?)',
      [appId, title, now, now],
    );
    this.session = { rowId: lastInsertRowid, appId, exeName: info.exeName, title, startTs: now, lastSeenTs: now };
  }

  private closeSession(endTs: number): void {
    if (!this.session) return;
    const finalEnd = Math.max(this.session.startTs, Math.min(endTs, this.deps.now()));
    this.db.run('UPDATE sessions SET end_ts = ?, title = ? WHERE id = ?', [
      finalEnd,
      this.session.title,
      this.session.rowId,
    ]);
    // Drop meaningless slivers (<1s) to keep the table clean.
    if (finalEnd - this.session.startTs < 1000) {
      this.db.run('DELETE FROM sessions WHERE id = ?', [this.session.rowId]);
    }
    this.session = null;
  }

  private openIdle(kind: IdleKind, startTs: number, endTs: number): void {
    const { lastInsertRowid } = this.db.run('INSERT INTO idle_periods (kind, start_ts, end_ts) VALUES (?, ?, ?)', [
      kind,
      startTs,
      endTs,
    ]);
    this.idle = { rowId: lastInsertRowid, kind, startTs };
  }

  private closeIdle(endTs: number): void {
    if (!this.idle) return;
    const finalEnd = Math.max(this.idle.startTs, endTs);
    this.db.run('UPDATE idle_periods SET end_ts = ? WHERE id = ?', [finalEnd, this.idle.rowId]);
    if (finalEnd - this.idle.startTs < 1000) {
      this.db.run('DELETE FROM idle_periods WHERE id = ?', [this.idle.rowId]);
    }
    this.idle = null;
  }

  /** Lock screen or system suspend: hard-stop the session and start a forced idle period. */
  forceIdle(kind: 'locked' | 'suspend'): void {
    const now = this.deps.now();
    this.closeSession(now);
    if (this.idle && this.idle.kind === kind) return;
    this.closeIdle(now);
    this.openIdle(kind, now, now);
  }

  /** Unlock / resume: end the forced idle period and let polling resume. */
  resumeFromForcedIdle(): void {
    const now = this.deps.now();
    if (this.idle && this.idle.kind !== 'idle') {
      this.db.run('UPDATE idle_periods SET end_ts = ? WHERE id = ?', [now, this.idle.rowId]);
      this.idle = null;
    }
  }

  status(): TrackingStatus {
    const paused = this.settings.get().trackingPaused;
    return {
      paused,
      state: paused ? 'stopped' : this.idle ? 'idle' : 'active',
      currentExe: this.session?.exeName ?? null,
      currentTitle: this.session?.title ?? null,
      sinceTs: this.session?.startTs ?? this.idle?.startTs ?? null,
    };
  }
}

export function truncateTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;
  return t.length > 200 ? t.slice(0, 200) : t;
}
