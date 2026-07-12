/**
 * IPC command surface. Every handler validates its payload before touching
 * the database — the renderer is treated as untrusted input.
 */
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import type { Db } from './db';
import type { Catalog } from './catalog';
import type { SettingsStore } from './settings';
import type { Tracker } from './tracker';
import type { FocusManager } from './focus';
import type { ExtensionServer } from './webserver';
import * as analytics from './analytics';
import { deleteData, writeExport } from './exporter';
import type { CategoryKind, Goal, GoalProgress, Range, Settings, TargetType } from '../shared/types';

const CATEGORY_KINDS: CategoryKind[] = ['productive', 'neutral', 'distracting'];
const SETTINGS_KEYS: (keyof Settings)[] = [
  'onboardingDone',
  'trackingPaused',
  'idleThresholdSec',
  'trackWindowTitles',
  'trackWebsites',
  'startWithWindows',
  'retentionDays',
  'excludedApps',
  'excludedDomains',
  'theme',
  'language',
  'extensionPort',
  'extensionToken',
];

class ValidationError extends Error {}

function obj(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null) throw new ValidationError('expected object');
  return v as Record<string, unknown>;
}

function num(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ValidationError(`${name} must be a number`);
  return v;
}

function id(v: unknown, name: string): number {
  const n = num(v, name);
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`${name} must be a positive integer`);
  return n;
}

function str(v: unknown, name: string, maxLen = 200): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > maxLen) {
    throw new ValidationError(`${name} must be a non-empty string (<= ${maxLen} chars)`);
  }
  return v;
}

function boolVal(v: unknown, name: string): boolean {
  if (typeof v !== 'boolean') throw new ValidationError(`${name} must be a boolean`);
  return v;
}

function range(v: unknown): Range {
  const o = obj(v);
  const from = num(o.from, 'from');
  const to = num(o.to, 'to');
  if (to < from) throw new ValidationError('to must be >= from');
  if (to - from > 366 * 2 * 86_400_000) throw new ValidationError('range too large');
  return { from, to };
}

/** Like range() but without the span cap — export/delete may cover all history. */
function rangeUncapped(v: unknown): Range {
  const o = obj(v);
  const from = num(o.from, 'from');
  const to = num(o.to, 'to');
  if (to < from) throw new ValidationError('to must be >= from');
  return { from, to };
}

function color(v: unknown): string {
  const s = str(v, 'color', 16);
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new ValidationError('color must be #rrggbb');
  return s;
}

function kind(v: unknown): CategoryKind {
  const s = str(v, 'kind', 20);
  if (!CATEGORY_KINDS.includes(s as CategoryKind)) throw new ValidationError('invalid kind');
  return s as CategoryKind;
}

export interface IpcContext {
  db: Db;
  catalog: Catalog;
  settings: SettingsStore;
  tracker: Tracker;
  focus: FocusManager;
  extServer: ExtensionServer;
  getWindow: () => BrowserWindow | null;
  applySettingsSideEffects: (before: Settings, after: Settings) => void;
  restart: () => void;
}

export function registerIpc(ctx: IpcContext): void {
  const { db, catalog, settings, tracker, focus } = ctx;

  const handle = (channel: string, fn: (payload: unknown) => unknown): void => {
    ipcMain.handle(channel, async (_event, payload: unknown) => {
      try {
        return await fn(payload);
      } catch (err) {
        if (err instanceof ValidationError) {
          console.warn(`[ipc] rejected ${channel}: ${err.message}`);
        } else {
          console.error(`[ipc] ${channel} failed:`, err);
        }
        throw err;
      }
    });
  };

  // ---- settings ----
  handle('settings:get', () => settings.get());
  handle('settings:update', (payload) => {
    const o = obj(payload);
    const patch: Record<string, unknown> = {};
    for (const key of SETTINGS_KEYS) {
      if (key in o) patch[key] = o[key];
    }
    delete patch.extensionToken; // token is app-managed, not settable from renderer
    const before = settings.get();
    const after = settings.update(patch);
    ctx.applySettingsSideEffects(before, after);
    return after;
  });

  // ---- analytics ----
  handle('analytics:summary', (p) => analytics.summary(db, range(p)));
  handle('analytics:apps', (p) => analytics.byApp(db, range(p)));
  handle('analytics:domains', (p) => analytics.byDomain(db, range(p)));
  handle('analytics:categories', (p) => analytics.byCategory(db, range(p)));
  handle('analytics:hourly', (p) => analytics.hourly(db, range(p)));
  handle('analytics:daily', (p) => analytics.daily(db, range(p)));
  handle('analytics:sessions', (p) => analytics.getSessions(db, range(p)));
  handle('analytics:webSessions', (p) => analytics.getWebSessions(db, range(p)));
  handle('analytics:insights', (p) => analytics.insights(db, range(p)));

  // ---- catalog ----
  handle('apps:list', () =>
    db.all(
      `SELECT a.id, a.exe_name AS exeName, a.display_name AS displayName, a.exe_path AS exePath,
              ca.category_id AS categoryId
       FROM apps a
       LEFT JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = a.id
       ORDER BY a.last_seen DESC`,
    ),
  );
  handle('domains:list', () =>
    db.all(
      `SELECT d.id, d.domain, ca.category_id AS categoryId
       FROM domains d
       LEFT JOIN category_assignments ca ON ca.target_type = 'domain' AND ca.target_id = d.id
       ORDER BY d.last_seen DESC`,
    ),
  );

  // ---- categories ----
  handle('categories:list', () => catalog.listCategories());
  handle('categories:create', (p) => {
    const o = obj(p);
    const name = str(o.name, 'name', 60);
    const { lastInsertRowid } = db.run('INSERT INTO categories (name, kind, color, is_builtin) VALUES (?, ?, ?, 0)', [
      name,
      kind(o.kind),
      color(o.color),
    ]);
    return { id: lastInsertRowid, name, kind: kind(o.kind), color: color(o.color), isBuiltin: false };
  });
  handle('categories:update', (p) => {
    const o = obj(p);
    const catId = id(o.id, 'id');
    if (o.name !== undefined) db.run('UPDATE categories SET name = ? WHERE id = ?', [str(o.name, 'name', 60), catId]);
    if (o.kind !== undefined) db.run('UPDATE categories SET kind = ? WHERE id = ?', [kind(o.kind), catId]);
    if (o.color !== undefined) db.run('UPDATE categories SET color = ? WHERE id = ?', [color(o.color), catId]);
  });
  handle('categories:delete', (p) => {
    const o = obj(p);
    const catId = id(o.id, 'id');
    const row = db.get<{ is_builtin: number }>('SELECT is_builtin FROM categories WHERE id = ?', [catId]);
    if (!row) throw new ValidationError('category not found');
    db.run('DELETE FROM categories WHERE id = ?', [catId]);
  });
  handle('categories:assign', (p) => {
    const o = obj(p);
    const targetType = str(o.targetType, 'targetType', 10);
    if (targetType !== 'app' && targetType !== 'domain') throw new ValidationError('invalid targetType');
    const categoryId = o.categoryId === null ? null : id(o.categoryId, 'categoryId');
    catalog.assign(targetType as TargetType, id(o.targetId, 'targetId'), categoryId);
  });

  // ---- goals ----
  handle('goals:list', (): GoalProgress[] => {
    const rows = db.all<{
      id: number;
      name: string;
      category_id: number;
      comparator: 'at_most' | 'at_least';
      minutes_per_day: number;
      active: number;
      categoryName: string;
      categoryKind: CategoryKind;
    }>(
      `SELECT g.*, c.name AS categoryName, c.kind AS categoryKind
       FROM goals g JOIN categories c ON c.id = g.category_id
       ORDER BY g.id`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      categoryId: r.category_id,
      comparator: r.comparator,
      minutesPerDay: r.minutes_per_day,
      active: r.active === 1,
      categoryName: r.categoryName,
      categoryKind: r.categoryKind,
      minutesToday: analytics.categoryMinutesToday(db, r.category_id, Date.now()),
    }));
  });
  handle('goals:create', (p): Goal => {
    const o = obj(p);
    const comparator = str(o.comparator, 'comparator', 10);
    if (comparator !== 'at_most' && comparator !== 'at_least') throw new ValidationError('invalid comparator');
    const goal = {
      name: str(o.name, 'name', 100),
      categoryId: id(o.categoryId, 'categoryId'),
      comparator: comparator as 'at_most' | 'at_least',
      minutesPerDay: Math.min(1440, Math.max(1, Math.round(num(o.minutesPerDay, 'minutesPerDay')))),
      active: boolVal(o.active ?? true, 'active'),
    };
    const { lastInsertRowid } = db.run(
      'INSERT INTO goals (name, category_id, comparator, minutes_per_day, active) VALUES (?, ?, ?, ?, ?)',
      [goal.name, goal.categoryId, goal.comparator, goal.minutesPerDay, goal.active ? 1 : 0],
    );
    return { id: lastInsertRowid, ...goal };
  });
  handle('goals:update', (p) => {
    const o = obj(p);
    const goalId = id(o.id, 'id');
    if (o.name !== undefined) db.run('UPDATE goals SET name = ? WHERE id = ?', [str(o.name, 'name', 100), goalId]);
    if (o.minutesPerDay !== undefined) {
      db.run('UPDATE goals SET minutes_per_day = ? WHERE id = ?', [
        Math.min(1440, Math.max(1, Math.round(num(o.minutesPerDay, 'minutesPerDay')))),
        goalId,
      ]);
    }
    if (o.active !== undefined) db.run('UPDATE goals SET active = ? WHERE id = ?', [boolVal(o.active, 'active') ? 1 : 0, goalId]);
  });
  handle('goals:delete', (p) => {
    db.run('DELETE FROM goals WHERE id = ?', [id(obj(p).id, 'id')]);
  });

  // ---- focus ----
  handle('focus:start', (p) => {
    const o = obj(p);
    const minutes = Math.min(480, Math.max(1, Math.round(num(o.plannedMinutes, 'plannedMinutes'))));
    const ids = Array.isArray(o.blockedCategoryIds)
      ? o.blockedCategoryIds.filter((x): x is number => Number.isInteger(x) && (x as number) > 0).slice(0, 50)
      : [];
    return focus.start(minutes, ids);
  });
  handle('focus:stop', () => focus.stop());
  handle('focus:status', () => focus.status());
  handle('focus:history', () => focus.history());

  // ---- tracking ----
  handle('tracking:status', () => tracker.status());
  handle('tracking:setPaused', (p) => {
    const paused = boolVal(obj(p).paused, 'paused');
    const before = settings.get();
    const after = settings.update({ trackingPaused: paused });
    ctx.applySettingsSideEffects(before, after);
    return tracker.status();
  });

  // ---- data ----
  handle('data:export', async (p) => {
    const o = obj(p);
    const format = str(o.format, 'format', 10);
    if (format !== 'csv' && format !== 'json') throw new ValidationError('invalid format');
    const r = rangeUncapped({ from: o.from, to: o.to });
    const win = ctx.getWindow();
    const opts: Electron.SaveDialogOptions = {
      title: 'Export TimeScope data',
      defaultPath: `timescope-export-${new Date().toISOString().slice(0, 10)}.${format}`,
      filters: format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'JSON', extensions: ['json'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { savedTo: null };
    writeExport(db, r, format, result.filePath);
    return { savedTo: result.filePath };
  });
  handle('data:delete', (p) => {
    const o = obj(p);
    const mode = str(o.mode, 'mode', 10);
    if (!['range', 'web', 'apps', 'all'].includes(mode)) throw new ValidationError('invalid mode');
    const r = mode === 'range' ? rangeUncapped({ from: o.from, to: o.to }) : undefined;
    const deletedRows = deleteData(db, mode as never, r);
    return { deletedRows };
  });

  // ---- onboarding ----
  handle('onboarding:complete', (p) => {
    const o = obj(p);
    const before = settings.get();
    const after = settings.update({
      onboardingDone: true,
      trackWindowTitles: boolVal(o.trackWindowTitles, 'trackWindowTitles'),
      trackWebsites: boolVal(o.trackWebsites, 'trackWebsites'),
    });
    ctx.applySettingsSideEffects(before, after);
    return after;
  });

  // ---- app info / control ----
  ipcMain.handle('system:info', () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
  }));
  handle('system:openDataDir', async () => {
    const err = await shell.openPath(app.getPath('userData'));
    return { opened: err === '' };
  });
  handle('system:restart', () => {
    ctx.restart();
  });
}
