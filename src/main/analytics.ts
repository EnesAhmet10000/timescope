/**
 * Analytics: aggregation of sessions / web sessions / idle periods into
 * summaries, per-app/domain/category totals, hourly and daily buckets.
 *
 * The math (interval clipping, bucketing) lives in exported pure functions
 * so it can be unit-tested; the query functions fetch rows and delegate.
 */
import type { Db } from './db';
import type {
  AppUsage,
  CategoryUsage,
  DayBucket,
  DomainUsage,
  HourBucket,
  Range,
  SessionRow,
  Summary,
  WebSessionRow,
  IdleRow,
  CategoryKind,
  IdleKind,
} from '../shared/types';

export interface Interval {
  startTs: number;
  endTs: number;
}

/** Milliseconds of `iv` that fall inside [from, to]. */
export function clippedMs(iv: Interval, range: Range): number {
  const start = Math.max(iv.startTs, range.from);
  const end = Math.min(iv.endTs, range.to);
  return Math.max(0, end - start);
}

export function sumClipped(intervals: Interval[], range: Range): number {
  let total = 0;
  for (const iv of intervals) total += clippedMs(iv, range);
  return total;
}

/** Split intervals into fixed-size buckets aligned to `alignTs`, clipping to the range. */
export function bucketize(intervals: Interval[], range: Range, bucketMs: number, alignTs: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const iv of intervals) {
    let start = Math.max(iv.startTs, range.from);
    const end = Math.min(iv.endTs, range.to);
    while (start < end) {
      const bucketStart = alignTs + Math.floor((start - alignTs) / bucketMs) * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const chunk = Math.min(end, bucketEnd) - start;
      out.set(bucketStart, (out.get(bucketStart) ?? 0) + chunk);
      start += chunk;
    }
  }
  return out;
}

const SESSION_SELECT = `
  SELECT s.id, s.app_id AS appId, a.exe_name AS exeName, a.display_name AS displayName,
         s.title, s.start_ts AS startTs, s.end_ts AS endTs,
         ca.category_id AS categoryId, c.kind AS categoryKind
  FROM sessions s
  JOIN apps a ON a.id = s.app_id
  LEFT JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = s.app_id
  LEFT JOIN categories c ON c.id = ca.category_id
  WHERE s.end_ts > ? AND s.start_ts < ?`;

const WEB_SESSION_SELECT = `
  SELECT w.id, w.domain_id AS domainId, d.domain, w.start_ts AS startTs, w.end_ts AS endTs,
         ca.category_id AS categoryId, c.kind AS categoryKind
  FROM web_sessions w
  JOIN domains d ON d.id = w.domain_id
  LEFT JOIN category_assignments ca ON ca.target_type = 'domain' AND ca.target_id = w.domain_id
  LEFT JOIN categories c ON c.id = ca.category_id
  WHERE w.end_ts > ? AND w.start_ts < ?`;

export function getSessions(db: Db, range: Range): SessionRow[] {
  return db.all<SessionRow>(`${SESSION_SELECT} ORDER BY s.start_ts`, [range.from, range.to]);
}

export function getWebSessions(db: Db, range: Range): WebSessionRow[] {
  return db.all<WebSessionRow>(`${WEB_SESSION_SELECT} ORDER BY w.start_ts`, [range.from, range.to]);
}

export function getIdlePeriods(db: Db, range: Range): IdleRow[] {
  return db.all<IdleRow>(
    'SELECT id, kind, start_ts AS startTs, end_ts AS endTs FROM idle_periods WHERE end_ts > ? AND start_ts < ? ORDER BY start_ts',
    [range.from, range.to],
  );
}

export function summary(db: Db, range: Range): Summary {
  const sessions = getSessions(db, range);
  const idle = getIdlePeriods(db, range);
  const web = getWebSessions(db, range);

  const s: Summary = {
    activeMs: 0,
    idleMs: sumClipped(idle, range),
    productiveMs: 0,
    neutralMs: 0,
    distractingMs: 0,
    uncategorizedMs: 0,
    webMs: sumClipped(web, range),
  };
  for (const row of sessions) {
    const ms = clippedMs(row, range);
    s.activeMs += ms;
    switch (row.categoryKind) {
      case 'productive':
        s.productiveMs += ms;
        break;
      case 'neutral':
        s.neutralMs += ms;
        break;
      case 'distracting':
        s.distractingMs += ms;
        break;
      default:
        s.uncategorizedMs += ms;
    }
  }
  return s;
}

export function byApp(db: Db, range: Range): AppUsage[] {
  const rows = db.all<{
    appId: number;
    exeName: string;
    displayName: string;
    categoryId: number | null;
    categoryName: string | null;
    categoryKind: CategoryKind | null;
    color: string | null;
    ms: number;
  }>(
    `SELECT s.app_id AS appId, a.exe_name AS exeName, a.display_name AS displayName,
            ca.category_id AS categoryId, c.name AS categoryName, c.kind AS categoryKind, c.color,
            SUM(MIN(s.end_ts, ?) - MAX(s.start_ts, ?)) AS ms
     FROM sessions s
     JOIN apps a ON a.id = s.app_id
     LEFT JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = s.app_id
     LEFT JOIN categories c ON c.id = ca.category_id
     WHERE s.end_ts > ? AND s.start_ts < ?
     GROUP BY s.app_id
     ORDER BY ms DESC`,
    [range.to, range.from, range.from, range.to],
  );
  return rows.filter((r) => r.ms > 0);
}

export function byDomain(db: Db, range: Range): DomainUsage[] {
  const rows = db.all<{
    domainId: number;
    domain: string;
    categoryId: number | null;
    categoryName: string | null;
    categoryKind: CategoryKind | null;
    color: string | null;
    ms: number;
  }>(
    `SELECT w.domain_id AS domainId, d.domain,
            ca.category_id AS categoryId, c.name AS categoryName, c.kind AS categoryKind, c.color,
            SUM(MIN(w.end_ts, ?) - MAX(w.start_ts, ?)) AS ms
     FROM web_sessions w
     JOIN domains d ON d.id = w.domain_id
     LEFT JOIN category_assignments ca ON ca.target_type = 'domain' AND ca.target_id = w.domain_id
     LEFT JOIN categories c ON c.id = ca.category_id
     WHERE w.end_ts > ? AND w.start_ts < ?
     GROUP BY w.domain_id
     ORDER BY ms DESC`,
    [range.to, range.from, range.from, range.to],
  );
  return rows.filter((r) => r.ms > 0);
}

export function byCategory(db: Db, range: Range): CategoryUsage[] {
  const rows = db.all<{
    categoryId: number | null;
    name: string | null;
    kind: CategoryKind | null;
    color: string | null;
    ms: number;
  }>(
    `SELECT ca.category_id AS categoryId, c.name, c.kind, c.color,
            SUM(MIN(s.end_ts, ?) - MAX(s.start_ts, ?)) AS ms
     FROM sessions s
     LEFT JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = s.app_id
     LEFT JOIN categories c ON c.id = ca.category_id
     WHERE s.end_ts > ? AND s.start_ts < ?
     GROUP BY ca.category_id
     ORDER BY ms DESC`,
    [range.to, range.from, range.from, range.to],
  );
  return rows
    .filter((r) => r.ms > 0)
    .map((r) => ({
      categoryId: r.categoryId,
      name: r.name ?? 'Uncategorized',
      kind: r.kind,
      color: r.color,
      ms: r.ms,
    }));
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Start-of-day (local time) for a timestamp. */
export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function hourly(db: Db, range: Range): HourBucket[] {
  const sessions = getSessions(db, range);
  const idle = getIdlePeriods(db, range);
  const align = startOfLocalDay(range.from);

  const active = bucketize(sessions, range, HOUR_MS, align);
  const productive = bucketize(sessions.filter((s) => s.categoryKind === 'productive'), range, HOUR_MS, align);
  const distracting = bucketize(sessions.filter((s) => s.categoryKind === 'distracting'), range, HOUR_MS, align);
  const idleB = bucketize(idle, range, HOUR_MS, align);

  const buckets: HourBucket[] = [];
  for (let t = align; t < range.to; t += HOUR_MS) {
    buckets.push({
      hourStartTs: t,
      activeMs: active.get(t) ?? 0,
      productiveMs: productive.get(t) ?? 0,
      distractingMs: distracting.get(t) ?? 0,
      idleMs: idleB.get(t) ?? 0,
    });
  }
  return buckets;
}

export function daily(db: Db, range: Range): DayBucket[] {
  const sessions = getSessions(db, range);
  const align = startOfLocalDay(range.from);

  const active = bucketize(sessions, range, DAY_MS, align);
  const productive = bucketize(sessions.filter((s) => s.categoryKind === 'productive'), range, DAY_MS, align);
  const distracting = bucketize(sessions.filter((s) => s.categoryKind === 'distracting'), range, DAY_MS, align);

  const buckets: DayBucket[] = [];
  for (let t = align; t < range.to; t += DAY_MS) {
    buckets.push({
      dayStartTs: t,
      activeMs: active.get(t) ?? 0,
      productiveMs: productive.get(t) ?? 0,
      distractingMs: distracting.get(t) ?? 0,
    });
  }
  return buckets;
}

/** Minutes spent today in a category (apps + websites are NOT double-counted: apps only). */
export function categoryMinutesToday(db: Db, categoryId: number, now: number): number {
  const range: Range = { from: startOfLocalDay(now), to: now };
  const row = db.get<{ ms: number | null }>(
    `SELECT SUM(MIN(s.end_ts, ?) - MAX(s.start_ts, ?)) AS ms
     FROM sessions s
     JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = s.app_id
     WHERE ca.category_id = ? AND s.end_ts > ? AND s.start_ts < ?`,
    [range.to, range.from, categoryId, range.from, range.to],
  );
  const webRow = db.get<{ ms: number | null }>(
    `SELECT SUM(MIN(w.end_ts, ?) - MAX(w.start_ts, ?)) AS ms
     FROM web_sessions w
     JOIN category_assignments ca ON ca.target_type = 'domain' AND ca.target_id = w.domain_id
     WHERE ca.category_id = ? AND w.end_ts > ? AND w.start_ts < ?`,
    [range.to, range.from, categoryId, range.from, range.to],
  );
  const ms = Math.max(row?.ms ?? 0, webRow?.ms ?? 0);
  return Math.round(ms / 60000);
}
