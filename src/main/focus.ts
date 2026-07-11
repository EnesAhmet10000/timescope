/**
 * Focus sessions: a countdown during which activity in user-selected
 * "distracting" categories triggers a warning notification (v1 warns, it
 * does not block). Distraction seconds and warning counts are recorded for
 * the post-session review.
 */
import type { Db } from './db';
import type { FocusSession, FocusStatus } from '../shared/types';
import { POLL_MS } from './tracker';

export class FocusManager {
  private active: FocusSession | null = null;
  private lastWarnTs = 0;
  private currentlyDistracting = false;
  /** Injected: show a desktop notification. */
  notify: (title: string, body: string) => void = () => {};
  now: () => number = Date.now;

  constructor(private db: Db) {
    // A crash mid-focus leaves an open row; close it on boot.
    this.db.run('UPDATE focus_sessions SET end_ts = start_ts + planned_minutes * 60000 WHERE end_ts IS NULL');
  }

  start(plannedMinutes: number, blockedCategoryIds: number[]): FocusSession {
    this.stop();
    const startTs = this.now();
    const { lastInsertRowid } = this.db.run(
      'INSERT INTO focus_sessions (start_ts, end_ts, planned_minutes, blocked_category_ids) VALUES (?, NULL, ?, ?)',
      [startTs, plannedMinutes, JSON.stringify(blockedCategoryIds)],
    );
    this.active = {
      id: lastInsertRowid,
      startTs,
      endTs: null,
      plannedMinutes,
      blockedCategoryIds,
      distractionSeconds: 0,
      warnings: 0,
    };
    this.currentlyDistracting = false;
    return { ...this.active };
  }

  stop(): FocusSession | null {
    if (!this.active) return null;
    const s = this.active;
    s.endTs = this.now();
    this.db.run('UPDATE focus_sessions SET end_ts = ?, distraction_seconds = ?, warnings = ? WHERE id = ?', [
      s.endTs,
      s.distractionSeconds,
      s.warnings,
      s.id,
    ]);
    this.active = null;
    this.currentlyDistracting = false;
    return s;
  }

  /** Called by the tracker after each poll with the current app's category. */
  onTick(categoryId: number | null, label: string): void {
    if (!this.active) return;
    const now = this.now();
    if (now >= this.active.startTs + this.active.plannedMinutes * 60000) {
      const done = this.stop();
      if (done) this.notify('Focus session complete', `${done.plannedMinutes} minutes are up. Nice work.`);
      return;
    }
    this.currentlyDistracting = categoryId !== null && this.active.blockedCategoryIds.includes(categoryId);
    if (this.currentlyDistracting) {
      this.active.distractionSeconds += Math.round(POLL_MS / 1000);
      if (now - this.lastWarnTs > 60_000) {
        this.lastWarnTs = now;
        this.active.warnings += 1;
        this.notify('Stay focused', `${label} is in a category you chose to avoid during this focus session.`);
      }
      this.db.run('UPDATE focus_sessions SET distraction_seconds = ?, warnings = ? WHERE id = ?', [
        this.active.distractionSeconds,
        this.active.warnings,
        this.active.id,
      ]);
    }
  }

  status(): FocusStatus {
    if (!this.active) return { session: null, remainingSec: 0, currentlyDistracting: false };
    const endAt = this.active.startTs + this.active.plannedMinutes * 60000;
    return {
      session: { ...this.active },
      remainingSec: Math.max(0, Math.round((endAt - this.now()) / 1000)),
      currentlyDistracting: this.currentlyDistracting,
    };
  }

  history(): FocusSession[] {
    return this.db
      .all<{
        id: number;
        start_ts: number;
        end_ts: number | null;
        planned_minutes: number;
        blocked_category_ids: string;
        distraction_seconds: number;
        warnings: number;
      }>('SELECT * FROM focus_sessions ORDER BY start_ts DESC LIMIT 50')
      .map((r) => ({
        id: r.id,
        startTs: r.start_ts,
        endTs: r.end_ts,
        plannedMinutes: r.planned_minutes,
        blockedCategoryIds: safeParseIds(r.blocked_category_ids),
        distractionSeconds: r.distraction_seconds,
        warnings: r.warnings,
      }));
  }
}

function safeParseIds(json: string): number[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
