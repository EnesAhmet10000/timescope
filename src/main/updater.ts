/**
 * Optional, fully manual updater. It never runs on its own: the app only
 * contacts GitHub when the user explicitly presses "Check for updates". This
 * keeps the privacy promise intact — no background network calls, no telemetry.
 *
 * Flow: check the repo's latest GitHub Release, compare its version to the
 * running one, and (if newer and the user asks) download that release's
 * Windows installer and launch it. No external dependency — just the GitHub
 * REST API over HTTPS.
 */
import { app } from 'electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { logError, logInfo } from './logger';
import type { UpdateInfo } from '../shared/types';

const REPO = 'EnesAhmet10000/timescope';

export class Updater {
  private state: UpdateInfo;

  constructor(private onEvent: (s: UpdateInfo) => void) {
    this.state = { status: 'idle', currentVersion: app.getVersion(), canInstall: app.isPackaged };
  }

  getState(): UpdateInfo {
    return this.state;
  }

  private set(patch: Partial<UpdateInfo>): void {
    this.state = { ...this.state, ...patch };
    this.onEvent(this.state);
  }

  /** Ask GitHub for the latest release and compare versions. User-initiated only. */
  async check(): Promise<UpdateInfo> {
    this.set({ status: 'checking', error: undefined });
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TimeScope-Updater' },
      });
      if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
      const data = (await res.json()) as {
        tag_name?: string;
        body?: string;
        assets?: { name: string; browser_download_url: string }[];
      };
      const latest = String(data.tag_name ?? '').replace(/^v/, '');
      const asset = (data.assets ?? []).find((a) => a.name.toLowerCase().endsWith('.exe'));
      const newer = compareVersions(latest, this.state.currentVersion) > 0;
      logInfo(`update check: current=${this.state.currentVersion} latest=${latest} newer=${newer}`);
      this.set({
        status: newer ? 'available' : 'up-to-date',
        latestVersion: latest || undefined,
        notes: data.body ?? '',
        downloadUrl: asset?.browser_download_url,
      });
    } catch (err) {
      logError('update check failed', err);
      this.set({ status: 'error', error: err instanceof Error ? err.message : 'check failed' });
    }
    return this.state;
  }

  /** Download the installer for the available release, reporting progress. */
  async download(): Promise<UpdateInfo> {
    if (!this.state.downloadUrl) {
      this.set({ status: 'error', error: 'No installer found for the latest release.' });
      return this.state;
    }
    this.set({ status: 'downloading', progress: 0, error: undefined });
    try {
      const res = await fetch(this.state.downloadUrl, { headers: { 'User-Agent': 'TimeScope-Updater' } });
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
      const total = Number(res.headers.get('content-length') ?? 0);
      const dest = path.join(app.getPath('temp'), `TimeScope-Setup-${this.state.latestVersion ?? 'latest'}.exe`);
      let received = 0;
      let lastPct = -1;
      const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
      body.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            this.set({ progress: pct });
          }
        }
      });
      await pipeline(body, createWriteStream(dest));
      logInfo(`update downloaded to ${dest}`);
      this.set({ status: 'downloaded', downloadedPath: dest, progress: 100 });
    } catch (err) {
      logError('update download failed', err);
      this.set({ status: 'error', error: err instanceof Error ? err.message : 'download failed' });
    }
    return this.state;
  }

  /** Launch the downloaded installer and quit so it can replace the app. */
  install(quit: () => void): void {
    if (!this.state.downloadedPath) return;
    logInfo('launching downloaded installer');
    try {
      spawn(this.state.downloadedPath, [], { detached: true, stdio: 'ignore' }).unref();
    } catch (err) {
      logError('failed to launch installer', err);
      this.set({ status: 'error', error: 'Could not launch the installer.' });
      return;
    }
    quit();
  }
}

/** Numeric semver-ish comparison of "x.y.z" strings. Returns >0 if a is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
