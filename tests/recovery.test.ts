import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Database as LegacyDatabase } from 'node-sqlite3-wasm';
import { openDb, snapshotDatabase } from '../src/main/db';
import { cleanupAll } from '../src/main/lifecycle';
import { makeCtx } from './helpers';
import { Tracker } from '../src/main/tracker';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timescope-recovery-test-'));
  return { dir, file: path.join(dir, 'timescope.db') };
}

describe('database crash recovery and preservation', () => {
  it('opens a real legacy WASM file without changing history and snapshots before migration', () => {
    const { file, dir } = fixture();
    const legacy = new LegacyDatabase(file);
    legacy.exec('CREATE TABLE history (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO history VALUES (1, \'retained\')');
    legacy.close();
    const db = openDb(file);
    expect(db.get('SELECT * FROM history')).toEqual({ id: 1, value: 'retained' });
    expect(db.get<{ integrity_check: string }>('PRAGMA integrity_check')?.integrity_check).toBe('ok');
    db.close();
    const backup = new LegacyDatabase(path.join(dir, 'backups', 'timescope.db.pre-native.db'));
    expect(backup.get('SELECT * FROM history')).toEqual({ id: 1, value: 'retained' });
    expect(backup.get("SELECT name FROM sqlite_master WHERE name='sessions'")).toBeNull();
    backup.close();
  });

  it('refuses an ambiguous legacy lock without removing it or changing the database', () => {
    const { file } = fixture();
    const db = openDb(file); db.close();
    const bytes = fs.readFileSync(file);
    fs.mkdirSync(`${file}.lock`);
    expect(() => openDb(file)).toThrow('older TimeScope');
    expect(fs.readFileSync(file)).toEqual(bytes);
    expect(fs.existsSync(`${file}.lock`)).toBe(true);
  });

  it('does not accept or overwrite an incomplete pre-upgrade backup', () => {
    const { file, dir } = fixture();
    const db = openDb(file); db.close();
    const bytes = fs.readFileSync(file);
    const backup = path.join(dir, 'backups', 'timescope.db.pre-native.db');
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, 'incomplete');
    expect(() => openDb(file)).toThrow('Incomplete backup');
    expect(fs.readFileSync(file)).toEqual(bytes);
    expect(fs.readFileSync(backup, 'utf8')).toBe('incomplete');
  });

  it('releases OS locks after an abrupt process death; keeps committed history and rolls back unfinished writes', () => {
    const { file } = fixture();
    const db = openDb(file);
    db.exec('CREATE TABLE crash_test (id INTEGER PRIMARY KEY)');
    db.close();
    const child = spawnSync(process.execPath, ['-e', `
      const {DatabaseSync}=require('node:sqlite');
      const db=new DatabaseSync(${JSON.stringify(file)});
      db.exec('INSERT INTO crash_test VALUES (1); BEGIN IMMEDIATE; INSERT INTO crash_test VALUES (2)');
      process.kill(process.pid, 'SIGKILL');
    `], { windowsHide: true, timeout: 10000 });
    expect(child.error).toBeUndefined();
    const reopened = openDb(file);
    expect(reopened.all('SELECT * FROM crash_test')).toEqual([{ id: 1 }]);
    expect(reopened.get<{ integrity_check: string }>('PRAGMA integrity_check')?.integrity_check).toBe('ok');
    reopened.close();
  });

  it('rejects concurrent writes and saves a snapshot containing committed WAL rows', () => {
    const { file, dir } = fixture();
    const first = openDb(file);
    first.exec('CREATE TABLE wal_test (id INTEGER PRIMARY KEY)');
    first.run('INSERT INTO wal_test VALUES (7)');
    const second = openDb(file);
    first.exec('BEGIN IMMEDIATE');
    expect(() => second.run('INSERT INTO wal_test VALUES (8)')).toThrow(/locked/);
    first.exec('ROLLBACK');
    const output = path.join(dir, "snapshot'quoted.db");
    snapshotDatabase(first, output);
    expect(() => snapshotDatabase(first, output)).toThrow();
    const snapshot = openDb(output);
    expect(snapshot.all('SELECT * FROM wal_test')).toEqual([{ id: 7 }]);
    snapshot.close(); second.close(); first.close();
  });

  it('still closes the database if tracker or server cleanup throws', () => {
    const events: string[] = [];
    cleanupAll([
      () => { events.push('tracker'); throw new Error('write failed'); },
      () => { events.push('server'); throw new Error('stop failed'); },
      () => { events.push('database closed'); },
    ], () => { events.push('error logged'); });
    expect(events).toEqual(['tracker', 'error logged', 'server', 'error logged', 'database closed']);
  });
});

describe('visible recording failures', () => {
  it('reports failed writes, retains the last save and does not fabricate activity during recovery', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    let now = 1000000;
    const tracker = new Tracker(ctx.db, ctx.catalog, ctx.settings, {
      now: () => now, getIdleSec: () => 0,
      getForeground: () => ({ exeName: 'editor', exePath: null, title: '' }),
    });
    const notify = vi.fn(); tracker.onHealthChanged = notify;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      tracker.start(); now += 2000; vi.advanceTimersByTime(2000);
      const lastSave = tracker.status().lastSavedTs;
      const run = vi.spyOn(ctx.db, 'run').mockImplementation(() => { throw new Error('disk full'); });
      now += 2000; vi.advanceTimersByTime(2000);
      expect(tracker.status()).toMatchObject({ state: 'error', error: 'disk full', lastSavedTs: lastSave });
      now += 60000; vi.advanceTimersByTime(2000);
      expect(notify).toHaveBeenCalledTimes(1);
      run.mockRestore();
      now += 2000; vi.advanceTimersByTime(2000);
      expect(tracker.status().state).toBe('active');
      const rows = ctx.db.all<{ start_ts: number; end_ts: number }>('SELECT start_ts,end_ts FROM sessions ORDER BY id');
      expect(rows).toHaveLength(2);
      expect(rows[0]!.end_ts).toBe(1002000);
      expect(rows[1]!.start_ts).toBe(now);
      expect(notify).toHaveBeenLastCalledWith(null);
    } finally { tracker.stop(); ctx.db.close(); log.mockRestore(); vi.useRealTimers(); }
  });
});
