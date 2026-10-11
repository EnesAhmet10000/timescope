/**
 * SQLite's native OS locks are released on process exit, including crashes.
 * The existing SQLite file and schema remain compatible; no history is reset.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export type SqlValue = number | string | null | bigint | Uint8Array | boolean;

export interface Db {
  readonly lastWriteTs: number | null;
  run(sql: string, params?: SqlValue[]): { changes: number; lastInsertRowid: number };
  get<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): T[];
  exec(sql: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

const MIGRATIONS: string[] = [
  // v1 — initial schema
  `
  CREATE TABLE apps (
    id INTEGER PRIMARY KEY,
    exe_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    exe_path TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE domains (
    id INTEGER PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('productive','neutral','distracting')),
    color TEXT NOT NULL,
    is_builtin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE category_assignments (
    id INTEGER PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('app','domain')),
    target_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE (target_type, target_id)
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    title TEXT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL
  );
  CREATE INDEX idx_sessions_start ON sessions(start_ts);
  CREATE INDEX idx_sessions_app ON sessions(app_id);

  CREATE TABLE web_sessions (
    id INTEGER PRIMARY KEY,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL
  );
  CREATE INDEX idx_web_sessions_start ON web_sessions(start_ts);

  CREATE TABLE idle_periods (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('idle','locked','suspend')),
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL
  );
  CREATE INDEX idx_idle_start ON idle_periods(start_ts);

  CREATE TABLE goals (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    comparator TEXT NOT NULL CHECK (comparator IN ('at_most','at_least')),
    minutes_per_day INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE focus_sessions (
    id INTEGER PRIMARY KEY,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER,
    planned_minutes INTEGER NOT NULL,
    blocked_category_ids TEXT NOT NULL DEFAULT '[]',
    distraction_seconds INTEGER NOT NULL DEFAULT 0,
    warnings INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

class SqliteDb implements Db {
  private db: DatabaseSync;
  lastWriteTs: number | null = null;

  constructor(filePath: string) {
    // Older WASM releases do not participate in SQLite's OS locking. Never
    // ignore or remove their lock: an older instance might still be writing.
    if (filePath !== ':memory:' && fs.existsSync(`${filePath}.lock`)) {
      throw new Error('An older TimeScope database lock exists. Close all older TimeScope copies before retrying. If the lock remains, preserve it for manual recovery; no data has been reset.');
    }
    const existing = filePath !== ':memory:' && fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
    this.db = new DatabaseSync(filePath);
    try {
      this.exec('PRAGMA busy_timeout = 1000;');
      if (existing) {
        const result = this.db.prepare('PRAGMA quick_check').all();
        if (result.some((row) => row.quick_check !== 'ok')) throw new Error('Database integrity check failed. Original data has been preserved.');
        // VACUUM INTO includes committed WAL data, unlike copying only .db.
        // Never overwrite this first, pre-migration snapshot.
        const dir = path.join(path.dirname(filePath), 'backups');
        fs.mkdirSync(dir, { recursive: true });
        const backup = path.join(dir, `${path.basename(filePath)}.pre-native.db`);
        if (!fs.existsSync(backup)) snapshotDatabase(this, backup);
        verifySnapshot(backup);
      }
      this.exec('PRAGMA journal_mode = WAL;');
      this.exec('PRAGMA synchronous = FULL;');
      this.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      this.db.close();
      throw err;
    }
  }

  run(sql: string, params: SqlValue[] = []): { changes: number; lastInsertRowid: number } {
    const r = this.db.prepare(sql).run(...bind(params));
    this.lastWriteTs = Date.now();
    return { changes: Number(r.changes ?? 0), lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
  }

  get<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.db.prepare(sql).get(...bind(params)) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    return this.db.prepare(sql).all(...bind(params)) as T[];
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    const lastWriteBefore = this.lastWriteTs;
    this.exec('BEGIN');
    try {
      const result = fn();
      this.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.exec('ROLLBACK');
      } catch {
        // ignore rollback failure; original error matters more
      }
      this.lastWriteTs = lastWriteBefore;
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}

export function openDb(filePath: string): Db {
  const db = new SqliteDb(filePath);
  try {
    migrate(db);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}

function bind(params: SqlValue[]) {
  return params.map((value) => typeof value === 'boolean' ? Number(value) : value);
}

/** A consistent SQLite snapshot, including WAL; fails if destination exists. */
export function snapshotDatabase(db: Db, destination: string): void {
  db.exec(`VACUUM main INTO '${destination.replace(/'/g, "''")}'`);
  verifySnapshot(destination);
}

function verifySnapshot(filePath: string): void {
  if (fs.statSync(filePath).size < 100) throw new Error('Incomplete backup snapshot. Preserve it for manual recovery before retrying.');
  const snapshot = new DatabaseSync(filePath, { readOnly: true });
  try {
    if (snapshot.prepare('PRAGMA quick_check').all().some((row) => row.quick_check !== 'ok')) {
      throw new Error('Backup snapshot integrity check failed. Original history has not been reset.');
    }
  } finally { snapshot.close(); }
}

export function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`);
  const row = db.get<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations');
  const current = row?.v ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) continue;
    db.transaction(() => {
      db.exec(sql);
      db.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [v + 1, Date.now()]);
    });
  }
}
