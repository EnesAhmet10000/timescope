import crypto from 'node:crypto';
import type { Db } from './db';
import type { Language, Settings, Theme } from '../shared/types';

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  trackingPaused: false,
  idleThresholdSec: 300, // 5 minutes
  trackWindowTitles: false, // opt-in during onboarding
  trackWebsites: false, // opt-in during onboarding
  startWithWindows: false,
  retentionDays: 0, // keep forever by default; user can shorten
  excludedApps: [],
  excludedDomains: [],
  theme: 'system',
  language: 'en', // English is the primary language
  extensionPort: 48733,
  extensionToken: '',
};

const THEMES: Theme[] = ['system', 'light', 'dark'];
const LANGUAGES: Language[] = ['en', 'ar', 'tr'];

export class SettingsStore {
  private cache: Settings;

  constructor(private db: Db) {
    this.cache = this.load();
    if (!this.cache.extensionToken) {
      this.update({ extensionToken: crypto.randomBytes(24).toString('hex') });
    }
  }

  private load(): Settings {
    const rows = this.db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
    const stored: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        stored[r.key] = JSON.parse(r.value);
      } catch {
        // ignore corrupt entries; defaults win
      }
    }
    return sanitize({ ...DEFAULT_SETTINGS, ...stored });
  }

  get(): Settings {
    return { ...this.cache };
  }

  update(patch: Partial<Settings>): Settings {
    const next = sanitize({ ...this.cache, ...patch });
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(next)) {
        this.db.run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, JSON.stringify(value)],
        );
      }
    });
    this.cache = next;
    return this.get();
  }
}

/** Coerce arbitrary stored/incoming values into a valid Settings object. */
export function sanitize(s: Record<string, unknown>): Settings {
  const d = DEFAULT_SETTINGS;
  return {
    onboardingDone: bool(s.onboardingDone, d.onboardingDone),
    trackingPaused: bool(s.trackingPaused, d.trackingPaused),
    idleThresholdSec: int(s.idleThresholdSec, d.idleThresholdSec, 30, 3600),
    trackWindowTitles: bool(s.trackWindowTitles, d.trackWindowTitles),
    trackWebsites: bool(s.trackWebsites, d.trackWebsites),
    startWithWindows: bool(s.startWithWindows, d.startWithWindows),
    retentionDays: int(s.retentionDays, d.retentionDays, 0, 3650),
    excludedApps: strArray(s.excludedApps),
    excludedDomains: strArray(s.excludedDomains),
    theme: THEMES.includes(s.theme as Theme) ? (s.theme as Theme) : d.theme,
    language: LANGUAGES.includes(s.language as Language) ? (s.language as Language) : d.language,
    extensionPort: int(s.extensionPort, d.extensionPort, 1024, 65535),
    extensionToken: typeof s.extensionToken === 'string' ? s.extensionToken : '',
  };
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0 && x.length < 256)
    .slice(0, 500);
}
