/**
 * Preload bridge: exposes a minimal, channel-allowlisted invoke API to the
 * renderer. The renderer never gets direct Node or Electron access.
 */
import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_CHANNELS = new Set([
  'settings:get',
  'settings:update',
  'analytics:summary',
  'analytics:apps',
  'analytics:domains',
  'analytics:categories',
  'analytics:hourly',
  'analytics:daily',
  'analytics:sessions',
  'analytics:webSessions',
  'apps:list',
  'domains:list',
  'categories:list',
  'categories:create',
  'categories:update',
  'categories:delete',
  'categories:assign',
  'goals:list',
  'goals:create',
  'goals:update',
  'goals:delete',
  'focus:start',
  'focus:stop',
  'focus:status',
  'focus:history',
  'tracking:status',
  'tracking:setPaused',
  'data:export',
  'data:delete',
  'onboarding:complete',
  'system:info',
]);

contextBridge.exposeInMainWorld('timescope', {
  invoke: (channel: string, payload?: unknown): Promise<unknown> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },
  onStateChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb();
    ipcRenderer.on('state-changed', listener);
    return () => ipcRenderer.removeListener('state-changed', listener);
  },
});
