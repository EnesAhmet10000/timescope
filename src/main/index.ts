/**
 * TimeScope main process: wires database, tracker, tray, focus manager,
 * extension endpoint and the dashboard window together.
 */
import { app, BrowserWindow, Notification, powerMonitor, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { openDb, type Db } from './db';
import { SettingsStore } from './settings';
import { Catalog } from './catalog';
import { Tracker } from './tracker';
import { FocusManager } from './focus';
import { ExtensionServer } from './webserver';
import { TrayController } from './tray';
import { registerIpc } from './ipc';
import { applyRetention } from './exporter';
import { getForegroundInfo } from './foreground';
import { initLogger, logError, logInfo } from './logger';
import { Updater } from './updater';
import * as analytics from './analytics';
import type { Settings } from '../shared/types';

const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
const isSmoke = process.env.TIMESCOPE_SMOKE === '1';

let win: BrowserWindow | null = null;
let quitting = false;
let restarting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  void main();
}

let db: Db;
let settings: SettingsStore;
let catalog: Catalog;
let tracker: Tracker;
let focus: FocusManager;
let extServer: ExtensionServer;
let tray: TrayController;
let updater: Updater;

async function main(): Promise<void> {
  await app.whenReady();

  if (!isSmoke) initLogger(app.getPath('userData'));

  const dbPath = isSmoke
    ? path.join(app.getPath('temp'), `timescope-smoke-${Date.now()}.db`)
    : path.join(app.getPath('userData'), 'timescope.db');
  try {
    // A relaunch (Restart button / in-place update) can start this process
    // while the previous one is still flushing its final close. Opening
    // mid-flush risks loading a torn snapshot of the file, which then looks
    // like "missing history". Wait until the file stops changing first.
    if (!isSmoke) await waitForStableFile(dbPath);
    db = openDb(dbPath);
    if (!isSmoke) {
      const n = db.get<{ c: number }>('SELECT COUNT(*) AS c FROM sessions')?.c ?? 0;
      logInfo(`database opened: ${n} sessions on disk`);
      backupDatabase(dbPath);
    }
  } catch (err) {
    logError('failed to open database', err);
    throw err;
  }
  settings = new SettingsStore(db);
  catalog = new Catalog(db);
  focus = new FocusManager(db);
  focus.notify = (title, body) => {
    if (Notification.isSupported()) new Notification({ title, body, silent: false }).show();
  };

  tracker = new Tracker(db, catalog, settings, {
    now: () => Date.now(),
    getForeground: getForegroundInfo,
    getIdleSec: () => powerMonitor.getSystemIdleTime(),
  });

  // Feed focus mode with the current app's category on every poll.
  const categoryCache = new Map<string, { categoryId: number | null; label: string; at: number }>();
  tracker.onActivity = (info) => {
    if (!info) return;
    let entry = categoryCache.get(info.exeName);
    if (!entry || Date.now() - entry.at > 30_000) {
      const row = db.get<{ categoryId: number | null; displayName: string }>(
        `SELECT ca.category_id AS categoryId, a.display_name AS displayName
         FROM apps a
         LEFT JOIN category_assignments ca ON ca.target_type = 'app' AND ca.target_id = a.id
         WHERE a.exe_name = ?`,
        [info.exeName],
      );
      entry = { categoryId: row?.categoryId ?? null, label: row?.displayName ?? info.exeName, at: Date.now() };
      categoryCache.set(info.exeName, entry);
    }
    focus.onTick(entry.categoryId, entry.label);
  };

  extServer = new ExtensionServer(db, catalog, settings);
  extServer.sync();

  updater = new Updater((s) => win?.webContents.send('update-event', s));

  tray = new TrayController({
    isPaused: () => settings.get().trackingPaused,
    setPaused: (paused) => {
      const before = settings.get();
      const after = settings.update({ trackingPaused: paused });
      applySettingsSideEffects(before, after);
    },
    openDashboard: () => showWindow(),
    openDataDir: () => {
      void shell.openPath(app.getPath('userData'));
    },
    restart: () => restartApp(),
    quit: () => {
      quitting = true;
      app.quit();
    },
  });
  tray.create();

  registerIpc({
    db,
    catalog,
    settings,
    tracker,
    focus,
    extServer,
    getWindow: () => win,
    applySettingsSideEffects,
    restart: restartApp,
    updater,
    quitForInstall: () => {
      quitting = true;
      app.quit();
    },
  });

  // Power / lock-screen integration. On resume/unlock we both end the forced
  // idle period AND make sure the poll loop is alive — belt-and-braces so a
  // missed event can never leave tracking permanently off.
  powerMonitor.on('lock-screen', () => tracker.forceIdle('locked'));
  powerMonitor.on('unlock-screen', () => {
    tracker.resumeFromForcedIdle();
    tracker.restartPolling();
  });
  powerMonitor.on('suspend', () => tracker.forceIdle('suspend'));
  powerMonitor.on('resume', () => {
    logInfo('system resume — restarting tracking loop');
    tracker.resumeFromForcedIdle();
    tracker.restartPolling();
  });
  powerMonitor.on('shutdown', () => tracker.stop());

  applyRetention(db, settings.get().retentionDays, Date.now());
  setInterval(() => applyRetention(db, settings.get().retentionDays, Date.now()), 6 * 3_600_000);

  // Health watchdog: recover a stalled tracker. Checks a heartbeat rather than
  // just whether the timer handle exists, because the OS can freeze timers
  // across sleep so the handle stays set but never fires again (the cause of
  // tracking silently stopping for hours). If no poll has run recently while
  // tracking is enabled, force-recreate the loop.
  const WATCHDOG_STALL_MS = 30_000;
  const reviveIfStalled = (): void => {
    if (settings.get().trackingPaused) return;
    if (!tracker.isRunning() || tracker.msSinceLastPoll(Date.now()) > WATCHDOG_STALL_MS) {
      logError(`watchdog: tracker stalled (${Math.round(tracker.msSinceLastPoll(Date.now()) / 1000)}s since last poll) — restarting loop`);
      tracker.restartPolling();
    }
  };
  setInterval(reviveIfStalled, 15_000);
  // Opening or focusing the dashboard is a strong signal the machine is awake:
  // revive tracking immediately so the user always sees current data.
  app.on('browser-window-focus', reviveIfStalled);

  tracker.start();
  createWindow();

  app.on('window-all-closed', () => {
    // Keep running in the tray; do not quit.
  });
  app.on('activate', () => showWindow());
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    try {
      tracker.stop();
      extServer.stop();
      db.close();
    } catch (err) {
      logError('shutdown error', err);
    }
  });

  if (isSmoke) void runSmoke();
}

/**
 * Wait until the database file's size/mtime stop changing (two identical stats
 * in a row), so we never load a snapshot torn by the previous process's final
 * flush. Returns quickly in the normal case; gives up after ~3 s and proceeds.
 */
async function waitForStableFile(filePath: string): Promise<void> {
  const statOf = (): string | null => {
    try {
      const s = fs.statSync(filePath);
      return `${s.size}:${s.mtimeMs}`;
    } catch {
      return null; // no file yet — nothing to wait for
    }
  };
  let prev = statOf();
  if (prev === null) return;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const cur = statOf();
    if (cur === prev) return;
    logInfo('database file still changing on open — waiting for previous instance to finish');
    prev = cur;
  }
}

const BACKUP_KEEP = 5;
const BACKUP_MIN_AGE_MS = 12 * 3_600_000;

/**
 * Rotating on-boot backup: copy the database into <userData>/backups at most
 * every 12 h, keeping the newest BACKUP_KEEP copies. Every write is persisted
 * to the main file as it happens, so a plain file copy is a consistent
 * snapshot — cheap insurance that history can always be recovered.
 */
function backupDatabase(dbPath: string): void {
  try {
    const dir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const existing = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('timescope-') && f.endsWith('.db'))
      .sort();
    const newest = existing[existing.length - 1];
    if (newest) {
      const age = Date.now() - fs.statSync(path.join(dir, newest)).mtimeMs;
      if (age < BACKUP_MIN_AGE_MS) return;
    }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    fs.copyFileSync(dbPath, path.join(dir, `timescope-${stamp}.db`));
    for (const f of existing.slice(0, Math.max(0, existing.length + 1 - BACKUP_KEEP))) {
      fs.rmSync(path.join(dir, f), { force: true });
    }
    logInfo(`database backup written (${existing.length + 1 > BACKUP_KEEP ? BACKUP_KEEP : existing.length + 1} kept)`);
  } catch (err) {
    logError('backup failed (non-fatal)', err);
  }
}

/** Cleanly flush + relaunch the app (used by the tray and the dashboard). */
function restartApp(): void {
  if (restarting) return;
  restarting = true;
  quitting = true;
  logInfo('restart requested');

  // app.quit() runs the shared will-quit cleanup, which stops tracking, closes
  // the database, and releases the extension server before the new process
  // starts. The relaunched process then opens a fresh database connection.
  app.relaunch();
  app.quit();
}

function applySettingsSideEffects(before: Settings, after: Settings): void {
  if (before.startWithWindows !== after.startWithWindows && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: after.startWithWindows, args: ['--hidden'] });
  }
  extServer.sync();
  tray.refresh();
  win?.webContents.send('state-changed');
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    show: !process.argv.includes('--hidden'),
    autoHideMenuBar: true,
    backgroundColor: '#0e1013',
    title: 'TimeScope',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win?.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

function showWindow(): void {
  if (!win) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

/** Automated smoke test: track for ~8s, print today's data as JSON, exit. */
async function runSmoke(): Promise<void> {
  console.log('[smoke] tracking for 8 seconds...');
  await new Promise((r) => setTimeout(r, 8000));
  const now = Date.now();
  const range = { from: analytics.startOfLocalDay(now), to: now };
  const result = {
    summary: analytics.summary(db, range),
    apps: analytics.byApp(db, range),
    status: tracker.status(),
    idleSec: powerMonitor.getSystemIdleTime(),
  };
  console.log('[smoke-result] ' + JSON.stringify(result));
  quitting = true;
  app.quit();
}
