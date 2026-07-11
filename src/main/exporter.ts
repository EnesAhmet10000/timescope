/**
 * Data export (CSV / JSON) and data deletion. Export contains only this
 * machine's local data; nothing ever leaves the device unless the user
 * explicitly saves a file somewhere.
 */
import fs from 'node:fs';
import type { Db } from './db';
import type { DeleteMode, Range } from '../shared/types';
import { getIdlePeriods, getSessions, getWebSessions } from './analytics';

export function buildJsonExport(db: Db, range: Range): string {
  return JSON.stringify(
    {
      app: 'TimeScope',
      exportedAt: new Date().toISOString(),
      range: { from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString() },
      sessions: getSessions(db, range).map((s) => ({
        app: s.displayName,
        exe: s.exeName,
        title: s.title,
        start: new Date(s.startTs).toISOString(),
        end: new Date(s.endTs).toISOString(),
        durationSec: Math.round((s.endTs - s.startTs) / 1000),
      })),
      webSessions: getWebSessions(db, range).map((w) => ({
        domain: w.domain,
        start: new Date(w.startTs).toISOString(),
        end: new Date(w.endTs).toISOString(),
        durationSec: Math.round((w.endTs - w.startTs) / 1000),
      })),
      idlePeriods: getIdlePeriods(db, range).map((i) => ({
        kind: i.kind,
        start: new Date(i.startTs).toISOString(),
        end: new Date(i.endTs).toISOString(),
        durationSec: Math.round((i.endTs - i.startTs) / 1000),
      })),
    },
    null,
    2,
  );
}

export function buildCsvExport(db: Db, range: Range): string {
  const lines = ['type,name,detail,start,end,duration_sec'];
  for (const s of getSessions(db, range)) {
    lines.push(
      csvRow(['app', s.displayName, s.title ?? '', iso(s.startTs), iso(s.endTs), String(sec(s.startTs, s.endTs))]),
    );
  }
  for (const w of getWebSessions(db, range)) {
    lines.push(csvRow(['website', w.domain, '', iso(w.startTs), iso(w.endTs), String(sec(w.startTs, w.endTs))]));
  }
  for (const i of getIdlePeriods(db, range)) {
    lines.push(csvRow(['idle', i.kind, '', iso(i.startTs), iso(i.endTs), String(sec(i.startTs, i.endTs))]));
  }
  return lines.join('\r\n');
}

export function writeExport(db: Db, range: Range, format: 'csv' | 'json', filePath: string): void {
  const content = format === 'csv' ? buildCsvExport(db, range) : buildJsonExport(db, range);
  fs.writeFileSync(filePath, content, 'utf8');
}

export function deleteData(db: Db, mode: DeleteMode, range?: Range): number {
  let deleted = 0;
  db.transaction(() => {
    switch (mode) {
      case 'range': {
        if (!range) throw new Error('range required');
        deleted += db.run('DELETE FROM sessions WHERE start_ts >= ? AND start_ts < ?', [range.from, range.to]).changes;
        deleted += db.run('DELETE FROM web_sessions WHERE start_ts >= ? AND start_ts < ?', [range.from, range.to]).changes;
        deleted += db.run('DELETE FROM idle_periods WHERE start_ts >= ? AND start_ts < ?', [range.from, range.to]).changes;
        break;
      }
      case 'web': {
        deleted += db.run('DELETE FROM web_sessions').changes;
        deleted += db.run('DELETE FROM domains').changes;
        break;
      }
      case 'apps': {
        deleted += db.run('DELETE FROM sessions').changes;
        deleted += db.run('DELETE FROM apps').changes;
        break;
      }
      case 'all': {
        deleted += db.run('DELETE FROM sessions').changes;
        deleted += db.run('DELETE FROM web_sessions').changes;
        deleted += db.run('DELETE FROM idle_periods').changes;
        deleted += db.run('DELETE FROM apps').changes;
        deleted += db.run('DELETE FROM domains').changes;
        deleted += db.run('DELETE FROM focus_sessions').changes;
        deleted += db.run('DELETE FROM goals').changes;
        break;
      }
    }
  });
  return deleted;
}

/** Delete rows older than retentionDays (0 = keep forever). */
export function applyRetention(db: Db, retentionDays: number, now: number): number {
  if (retentionDays <= 0) return 0;
  const cutoff = now - retentionDays * 86_400_000;
  let n = 0;
  n += db.run('DELETE FROM sessions WHERE end_ts < ?', [cutoff]).changes;
  n += db.run('DELETE FROM web_sessions WHERE end_ts < ?', [cutoff]).changes;
  n += db.run('DELETE FROM idle_periods WHERE end_ts < ?', [cutoff]).changes;
  return n;
}

function csvRow(fields: string[]): string {
  return fields.map((f) => (/[",\r\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(',');
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function sec(a: number, b: number): number {
  return Math.round((b - a) / 1000);
}
