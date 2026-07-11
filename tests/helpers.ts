import { openDb, type Db } from '../src/main/db';
import { Catalog } from '../src/main/catalog';
import { SettingsStore } from '../src/main/settings';

export interface TestCtx {
  db: Db;
  catalog: Catalog;
  settings: SettingsStore;
}

export function makeCtx(): TestCtx {
  const db = openDb(':memory:');
  const catalog = new Catalog(db);
  const settings = new SettingsStore(db);
  return { db, catalog, settings };
}

export function insertSession(ctx: TestCtx, exe: string, startTs: number, endTs: number): void {
  const appId = ctx.catalog.ensureApp(exe, null);
  ctx.db.run('INSERT INTO sessions (app_id, title, start_ts, end_ts) VALUES (?, NULL, ?, ?)', [appId, startTs, endTs]);
}

export function insertIdle(ctx: TestCtx, startTs: number, endTs: number): void {
  ctx.db.run("INSERT INTO idle_periods (kind, start_ts, end_ts) VALUES ('idle', ?, ?)", [startTs, endTs]);
}
