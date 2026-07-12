/**
 * System tray: icon reflects tracking state (colored = tracking,
 * gray = paused), context menu with pause/resume, open dashboard, quit.
 */
import { Menu, Tray, nativeImage, app } from 'electron';
import path from 'node:path';

export interface TrayCallbacks {
  isPaused: () => boolean;
  setPaused: (paused: boolean) => void;
  openDashboard: () => void;
  openDataDir: () => void;
  restart: () => void;
  quit: () => void;
}

export class TrayController {
  private tray: Tray | null = null;

  constructor(private cb: TrayCallbacks) {}

  create(): void {
    const icon = this.loadIcon(this.cb.isPaused());
    this.tray = new Tray(icon);
    this.tray.setToolTip('TimeScope');
    this.tray.on('double-click', () => this.cb.openDashboard());
    this.refresh();
  }

  private loadIcon(paused: boolean): Electron.NativeImage {
    const name = paused ? 'tray-paused.png' : 'tray-active.png';
    const p = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', name)
      : path.join(app.getAppPath(), 'assets', name);
    const img = nativeImage.createFromPath(p);
    return img.isEmpty() ? nativeImage.createEmpty() : img;
  }

  refresh(): void {
    if (!this.tray) return;
    const paused = this.cb.isPaused();
    this.tray.setImage(this.loadIcon(paused));
    this.tray.setToolTip(paused ? 'TimeScope — tracking paused' : 'TimeScope — tracking active');
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: paused ? '● Tracking is PAUSED' : '● Tracking is ON', enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => this.cb.openDashboard() },
        paused
          ? { label: 'Resume Tracking', click: () => this.cb.setPaused(false) }
          : { label: 'Pause Tracking', click: () => this.cb.setPaused(true) },
        { type: 'separator' },
        { label: 'Open Data Folder', click: () => this.cb.openDataDir() },
        { label: 'Restart TimeScope', click: () => this.cb.restart() },
        { type: 'separator' },
        { label: 'Quit TimeScope', click: () => this.cb.quit() },
      ]),
    );
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
