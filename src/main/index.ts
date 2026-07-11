/**
 * TimeScope main process: wires database, tracker, tray, focus manager,
 * extension endpoint and the dashboard window together.
 */
import { app, BrowserWindow, Notification, powerMonitor, shell } from 'electron';
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
import { getForegroundInfo } from './win32';
import * as analytics from './analytics';
import type { Settings } from '../shared/types';

const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
const isSmoke = process.env.TIMESCOPE_SMOKE === '1';

let win: BrowserWindow | null = null;
let quitting = false;

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

async function main(): Promise<void> {
  await app.whenReady();

  const dbPath = isSmoke
    ? path.join(app.getPath('temp'), `timescope-smoke-${Date.now()}.db`)
    : path.join(app.getPath('userData'), 'timescope.db');
  db = openDb(dbPath);
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

  tray = new TrayController({
    isPaused: () => settings.get().trackingPaused,
    setPaused: (paused) => {
      const before = settings.get();
      const after = settings.update({ trackingPaused: paused });
      applySettingsSideEffects(before, after);
    },
    openDashboard: () => showWindow(),
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
  });

  // Power / lock-screen integration.
  powerMonitor.on('lock-screen', () => tracker.forceIdle('locked'));
  powerMonitor.on('unlock-screen', () => tracker.resumeFromForcedIdle());
  powerMonitor.on('suspend', () => tracker.forceIdle('suspend'));
  powerMonitor.on('resume', () => tracker.resumeFromForcedIdle());
  powerMonitor.on('shutdown', () => tracker.stop());

  applyRetention(db, settings.get().retentionDays, Date.now());
  setInterval(() => applyRetention(db, settings.get().retentionDays, Date.now()), 6 * 3_600_000);

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
      console.error('shutdown error:', err);
    }
  });

  if (isSmoke) void runSmoke();
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
