/**
 * Apps/domains registry + categories: default category seeding, friendly app
 * names, and automatic categorization of well-known apps and domains.
 */
import type { Db } from './db';
import type { Category, CategoryKind, TargetType } from '../shared/types';

interface SeedCategory {
  name: string;
  kind: CategoryKind;
  color: string;
}

const SEED_CATEGORIES: SeedCategory[] = [
  { name: 'Productive', kind: 'productive', color: '#10b981' },
  { name: 'Development', kind: 'productive', color: '#6366f1' },
  { name: 'Communication', kind: 'neutral', color: '#0ea5e9' },
  { name: 'Browsing', kind: 'neutral', color: '#f59e0b' },
  { name: 'Education', kind: 'productive', color: '#14b8a6' },
  { name: 'Entertainment', kind: 'distracting', color: '#f43f5e' },
  { name: 'Social Media', kind: 'distracting', color: '#d946ef' },
  { name: 'Video', kind: 'distracting', color: '#ef4444' },
];

/** exe name (lowercase, no .exe) -> [friendly name, seed category name | null] */
const KNOWN_APPS: Record<string, [string, string | null]> = {
  code: ['Visual Studio Code', 'Development'],
  devenv: ['Visual Studio', 'Development'],
  idea64: ['IntelliJ IDEA', 'Development'],
  pycharm64: ['PyCharm', 'Development'],
  webstorm64: ['WebStorm', 'Development'],
  sublime_text: ['Sublime Text', 'Development'],
  windowsterminal: ['Windows Terminal', 'Development'],
  wt: ['Windows Terminal', 'Development'],
  powershell: ['PowerShell', 'Development'],
  pwsh: ['PowerShell', 'Development'],
  cmd: ['Command Prompt', 'Development'],
  cursor: ['Cursor', 'Development'],
  claude: ['Claude', 'Development'],
  chrome: ['Google Chrome', 'Browsing'],
  msedge: ['Microsoft Edge', 'Browsing'],
  firefox: ['Firefox', 'Browsing'],
  brave: ['Brave', 'Browsing'],
  opera: ['Opera', 'Browsing'],
  vivaldi: ['Vivaldi', 'Browsing'],
  slack: ['Slack', 'Communication'],
  discord: ['Discord', 'Communication'],
  teams: ['Microsoft Teams', 'Communication'],
  ms_teams: ['Microsoft Teams', 'Communication'],
  outlook: ['Outlook', 'Communication'],
  olk: ['Outlook', 'Communication'],
  telegram: ['Telegram', 'Communication'],
  whatsapp: ['WhatsApp', 'Communication'],
  zoom: ['Zoom', 'Communication'],
  winword: ['Microsoft Word', 'Productive'],
  excel: ['Microsoft Excel', 'Productive'],
  powerpnt: ['Microsoft PowerPoint', 'Productive'],
  onenote: ['OneNote', 'Productive'],
  notion: ['Notion', 'Productive'],
  obsidian: ['Obsidian', 'Productive'],
  acrobat: ['Adobe Acrobat', 'Productive'],
  figma: ['Figma', 'Productive'],
  spotify: ['Spotify', 'Entertainment'],
  vlc: ['VLC', 'Video'],
  steam: ['Steam', 'Entertainment'],
  epicgameslauncher: ['Epic Games', 'Entertainment'],
  robloxplayerbeta: ['Roblox', 'Entertainment'],
  javaw: ['Java App', null],
  explorer: ['File Explorer', null],
  notepad: ['Notepad', 'Productive'],
  'notepad++': ['Notepad++', 'Development'],
};

/** domain -> seed category name */
const KNOWN_DOMAINS: Record<string, string> = {
  'github.com': 'Development',
  'gitlab.com': 'Development',
  'stackoverflow.com': 'Development',
  'developer.mozilla.org': 'Development',
  'chatgpt.com': 'Productive',
  'claude.ai': 'Productive',
  'docs.google.com': 'Productive',
  'notion.so': 'Productive',
  'linear.app': 'Productive',
  'figma.com': 'Productive',
  'gmail.com': 'Communication',
  'mail.google.com': 'Communication',
  'slack.com': 'Communication',
  'discord.com': 'Communication',
  'web.whatsapp.com': 'Communication',
  'youtube.com': 'Video',
  'netflix.com': 'Video',
  'twitch.tv': 'Video',
  'x.com': 'Social Media',
  'twitter.com': 'Social Media',
  'instagram.com': 'Social Media',
  'facebook.com': 'Social Media',
  'reddit.com': 'Social Media',
  'tiktok.com': 'Social Media',
  'linkedin.com': 'Social Media',
  'wikipedia.org': 'Education',
  'coursera.org': 'Education',
  'udemy.com': 'Education',
  'khanacademy.org': 'Education',
};

export class Catalog {
  private appIdCache = new Map<string, number>();
  private domainIdCache = new Map<string, number>();

  constructor(private db: Db) {
    this.seedCategories();
  }

  private seedCategories(): void {
    const count = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')?.n ?? 0;
    if (count > 0) return;
    this.db.transaction(() => {
      for (const c of SEED_CATEGORIES) {
        this.db.run('INSERT INTO categories (name, kind, color, is_builtin) VALUES (?, ?, ?, 1)', [
          c.name,
          c.kind,
          c.color,
        ]);
      }
    });
  }

  private categoryIdByName(name: string): number | null {
    const row = this.db.get<{ id: number }>('SELECT id FROM categories WHERE name = ?', [name]);
    return row?.id ?? null;
  }

  /** Get or create an app row; auto-categorizes known apps on first sight. */
  ensureApp(exeName: string, exePath: string | null): number {
    const cached = this.appIdCache.get(exeName);
    if (cached !== undefined) {
      this.db.run('UPDATE apps SET last_seen = ? WHERE id = ?', [Date.now(), cached]);
      return cached;
    }
    const existing = this.db.get<{ id: number }>('SELECT id FROM apps WHERE exe_name = ?', [exeName]);
    if (existing) {
      this.appIdCache.set(exeName, existing.id);
      return existing.id;
    }
    const known = KNOWN_APPS[exeName];
    const displayName = known?.[0] ?? prettifyExeName(exeName);
    const now = Date.now();
    const { lastInsertRowid: id } = this.db.run(
      'INSERT INTO apps (exe_name, display_name, exe_path, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)',
      [exeName, displayName, exePath, now, now],
    );
    const catName = known?.[1];
    if (catName) {
      const catId = this.categoryIdByName(catName);
      if (catId !== null) this.assign('app', id, catId);
    }
    this.appIdCache.set(exeName, id);
    return id;
  }

  /** Get or create a domain row; auto-categorizes known domains on first sight. */
  ensureDomain(domain: string): number {
    const cached = this.domainIdCache.get(domain);
    if (cached !== undefined) {
      this.db.run('UPDATE domains SET last_seen = ? WHERE id = ?', [Date.now(), cached]);
      return cached;
    }
    const existing = this.db.get<{ id: number }>('SELECT id FROM domains WHERE domain = ?', [domain]);
    if (existing) {
      this.domainIdCache.set(domain, existing.id);
      return existing.id;
    }
    const now = Date.now();
    const { lastInsertRowid: id } = this.db.run(
      'INSERT INTO domains (domain, first_seen, last_seen) VALUES (?, ?, ?)',
      [domain, now, now],
    );
    const catName = KNOWN_DOMAINS[domain] ?? KNOWN_DOMAINS[domain.replace(/^www\./, '')];
    if (catName) {
      const catId = this.categoryIdByName(catName);
      if (catId !== null) this.assign('domain', id, catId);
    }
    this.domainIdCache.set(domain, id);
    return id;
  }

  assign(targetType: TargetType, targetId: number, categoryId: number | null): void {
    if (categoryId === null) {
      this.db.run('DELETE FROM category_assignments WHERE target_type = ? AND target_id = ?', [targetType, targetId]);
      return;
    }
    this.db.run(
      `INSERT INTO category_assignments (target_type, target_id, category_id) VALUES (?, ?, ?)
       ON CONFLICT(target_type, target_id) DO UPDATE SET category_id = excluded.category_id`,
      [targetType, targetId, categoryId],
    );
  }

  listCategories(): Category[] {
    return this.db
      .all<{ id: number; name: string; kind: CategoryKind; color: string; is_builtin: number }>(
        'SELECT id, name, kind, color, is_builtin FROM categories ORDER BY name',
      )
      .map((r) => ({ id: r.id, name: r.name, kind: r.kind, color: r.color, isBuiltin: r.is_builtin === 1 }));
  }
}

export function prettifyExeName(exeName: string): string {
  return exeName
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}
