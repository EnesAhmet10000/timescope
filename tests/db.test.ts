import { describe, expect, it } from 'vitest';
import { openDb } from '../src/main/db';
import { makeCtx, insertSession } from './helpers';
import { applyRetention, buildCsvExport, buildJsonExport, deleteData } from '../src/main/exporter';
import { normalizeDomain } from '../src/main/webserver';
import { sanitize, DEFAULT_SETTINGS } from '../src/main/settings';
import { prettifyExeName } from '../src/main/catalog';

describe('database', () => {
  it('migrates a fresh database and is idempotent', () => {
    const db = openDb(':memory:');
    const tables = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((r) => r.name);
    for (const t of ['apps', 'domains', 'categories', 'sessions', 'web_sessions', 'idle_periods', 'goals', 'focus_sessions', 'settings']) {
      expect(tables).toContain(t);
    }
    const v = db.get<{ v: number }>('SELECT MAX(version) AS v FROM schema_migrations');
    expect(v?.v).toBe(1);
  });

  it('seeds builtin categories once', () => {
    const ctx = makeCtx();
    const n = ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')?.n;
    expect(n).toBeGreaterThanOrEqual(8);
  });

  it('deleting a category cascades its assignments', () => {
    const ctx = makeCtx();
    const appId = ctx.catalog.ensureApp('code', null); // auto-assigned to Development
    const before = ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM category_assignments WHERE target_type='app' AND target_id = ?",
      [appId],
    )?.n;
    expect(before).toBe(1);
    const cat = ctx.db.get<{ id: number }>("SELECT id FROM categories WHERE name = 'Development'");
    ctx.db.run('DELETE FROM categories WHERE id = ?', [cat!.id]);
    const after = ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM category_assignments WHERE target_type='app' AND target_id = ?",
      [appId],
    )?.n;
    expect(after).toBe(0);
  });
});

describe('deletion & retention', () => {
  const T0 = new Date(2026, 5, 15).getTime();
  const H = 3_600_000;

  it('deletes by date range', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0, T0 + H);
    insertSession(ctx, 'code', T0 + 48 * H, T0 + 49 * H);
    const n = deleteData(ctx.db, 'range', { from: T0, to: T0 + 24 * H });
    expect(n).toBe(1);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')?.n).toBe(1);
  });

  it('deletes web data only / app data only / everything', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0, T0 + H);
    const domainId = ctx.catalog.ensureDomain('youtube.com');
    ctx.db.run('INSERT INTO web_sessions (domain_id, start_ts, end_ts) VALUES (?, ?, ?)', [domainId, T0, T0 + H]);

    deleteData(ctx.db, 'web');
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM web_sessions')?.n).toBe(0);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')?.n).toBe(1);

    deleteData(ctx.db, 'all');
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')?.n).toBe(0);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM apps')?.n).toBe(0);
  });

  it('retention removes only old rows', () => {
    const ctx = makeCtx();
    const now = Date.now();
    insertSession(ctx, 'code', now - 100 * 86_400_000, now - 100 * 86_400_000 + H);
    insertSession(ctx, 'code', now - H, now);
    const n = applyRetention(ctx.db, 30, now);
    expect(n).toBe(1);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')?.n).toBe(1);
  });
});

describe('export', () => {
  it('produces valid JSON with ISO dates', () => {
    const ctx = makeCtx();
    const T0 = new Date(2026, 5, 15, 9).getTime();
    insertSession(ctx, 'code', T0, T0 + 3_600_000);
    const parsed = JSON.parse(buildJsonExport(ctx.db, { from: T0 - 1, to: T0 + 7_200_000 }));
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].exe).toBe('code');
    expect(parsed.sessions[0].durationSec).toBe(3600);
  });

  it('escapes CSV fields containing commas and quotes', () => {
    const ctx = makeCtx();
    const T0 = new Date(2026, 5, 15, 9).getTime();
    const appId = ctx.catalog.ensureApp('weird', null);
    ctx.db.run('INSERT INTO sessions (app_id, title, start_ts, end_ts) VALUES (?, ?, ?, ?)', [
      appId,
      'Hello, "world"',
      T0,
      T0 + 60_000,
    ]);
    const csv = buildCsvExport(ctx.db, { from: T0 - 1, to: T0 + 120_000 });
    expect(csv).toContain('"Hello, ""world"""');
    expect(csv.split('\r\n')[0]).toBe('type,name,detail,start,end,duration_sec');
  });
});

describe('input validation helpers', () => {
  it('normalizeDomain accepts real domains and rejects junk', () => {
    expect(normalizeDomain('www.YouTube.com')).toBe('youtube.com');
    expect(normalizeDomain('sub.example.co.uk')).toBe('sub.example.co.uk');
    expect(normalizeDomain('localhost')).toBeNull(); // no TLD
    expect(normalizeDomain('http://evil.com/path')).toBeNull();
    expect(normalizeDomain('a b.com')).toBeNull();
    expect(normalizeDomain(42)).toBeNull();
    expect(normalizeDomain('')).toBeNull();
  });

  it('sanitize clamps settings to safe values', () => {
    const s = sanitize({ ...DEFAULT_SETTINGS, idleThresholdSec: 5, retentionDays: -3, theme: 'neon' });
    expect(s.idleThresholdSec).toBe(30); // min clamp
    expect(s.retentionDays).toBe(0);
    expect(s.theme).toBe('system');
  });

  it('prettifyExeName produces readable names', () => {
    expect(prettifyExeName('some_cool-app')).toBe('Some Cool App');
    expect(prettifyExeName('notepad')).toBe('Notepad');
  });
});
