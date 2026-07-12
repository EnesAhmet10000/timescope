/**
 * Dev-only UI preview harness. Loaded ONLY when running under the Vite dev
 * server with `?mock` in the URL (see main.tsx); it is never part of a
 * production build. Fabricates plausible in-memory data so the dashboard can
 * be designed/tested in a plain browser without Electron.
 */
import type { Category, FocusSession, GoalProgress, Settings } from '../shared/types';

export function installDevMock(): void {
  const DAY = 86_400_000;
  const H = 3_600_000;
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();

  const categories: Category[] = [
    { id: 1, name: 'Productive', kind: 'productive', color: '#10b981', isBuiltin: true },
    { id: 2, name: 'Development', kind: 'productive', color: '#6366f1', isBuiltin: true },
    { id: 3, name: 'Communication', kind: 'neutral', color: '#0ea5e9', isBuiltin: true },
    { id: 4, name: 'Browsing', kind: 'neutral', color: '#f59e0b', isBuiltin: true },
    { id: 5, name: 'Entertainment', kind: 'distracting', color: '#f43f5e', isBuiltin: true },
    { id: 6, name: 'Social Media', kind: 'distracting', color: '#d946ef', isBuiltin: true },
  ];

  const apps = [
    { appId: 1, exeName: 'code', displayName: 'Visual Studio Code', categoryId: 2, hours: 3.4 },
    { appId: 2, exeName: 'chrome', displayName: 'Google Chrome', categoryId: 4, hours: 2.1 },
    { appId: 3, exeName: 'slack', displayName: 'Slack', categoryId: 3, hours: 1.2 },
    { appId: 4, exeName: 'spotify', displayName: 'Spotify', categoryId: 5, hours: 0.7 },
    { appId: 5, exeName: 'winword', displayName: 'Microsoft Word', categoryId: 1, hours: 0.6 },
  ];
  const domains = [
    { domainId: 1, domain: 'github.com', categoryId: 2, hours: 1.4 },
    { domainId: 2, domain: 'stackoverflow.com', categoryId: 2, hours: 0.6 },
    { domainId: 3, domain: 'youtube.com', categoryId: 5, hours: 0.9 },
    { domainId: 4, domain: 'x.com', categoryId: 6, hours: 0.4 },
  ];
  const cat = (id: number | null): Category | undefined => categories.find((c) => c.id === id);

  let settings: Settings = {
    onboardingDone: true,
    trackingPaused: false,
    idleThresholdSec: 300,
    trackWindowTitles: true,
    trackWebsites: true,
    startWithWindows: false,
    retentionDays: 0,
    excludedApps: ['keepass'],
    excludedDomains: ['mybank.com'],
    theme: 'system',
    extensionPort: 48733,
    extensionToken: 'mock-token-abcdef',
  };

  let focusSession: FocusSession | null = null;

  const goals: GoalProgress[] = [
    {
      id: 1,
      name: 'Less than 1h social media',
      categoryId: 6,
      comparator: 'at_most',
      minutesPerDay: 60,
      active: true,
      categoryName: 'Social Media',
      categoryKind: 'distracting',
      minutesToday: 24,
    },
    {
      id: 2,
      name: 'At least 3h development',
      categoryId: 2,
      comparator: 'at_least',
      minutesPerDay: 180,
      active: true,
      categoryName: 'Development',
      categoryKind: 'productive',
      minutesToday: 204,
    },
  ];

  const hourWeights = [0, 0, 0, 0, 0, 0, 0, 0.2, 0.6, 0.9, 1, 0.8, 0.5, 0.9, 1, 0.95, 0.7, 0.5, 0.3, 0.4, 0.3, 0.1, 0, 0];

  function hourlyFor(from: number, to: number) {
    const out = [];
    for (let t = from; t < to; t += H) {
      const h = new Date(t).getHours();
      const w = hourWeights[h] ?? 0;
      const active = Math.round(w * 52 * 60000);
      out.push({
        hourStartTs: t,
        activeMs: active,
        productiveMs: Math.round(active * 0.55),
        distractingMs: Math.round(active * 0.18),
        idleMs: Math.round((1 - w) * 8 * 60000),
      });
    }
    return out;
  }

  function sessionsFor(from: number, to: number) {
    const rows = [];
    let t = Math.max(from, t0 + 8.5 * H);
    let id = 1;
    while (t < Math.min(to, now) && rows.length < 60) {
      const app = apps[id % apps.length]!;
      const dur = (8 + (id * 7) % 42) * 60000;
      rows.push({
        id: id++,
        appId: app.appId,
        exeName: app.exeName,
        displayName: app.displayName,
        title: settings.trackWindowTitles ? `${app.displayName} — window` : null,
        startTs: t,
        endTs: Math.min(t + dur, now),
        categoryId: app.categoryId,
        categoryKind: cat(app.categoryId)?.kind ?? null,
      });
      t += dur + 3 * 60000;
    }
    return rows;
  }

  const handlers: Record<string, (p?: unknown) => unknown> = {
    'settings:get': () => settings,
    'settings:update': (p) => {
      settings = { ...settings, ...(p as Partial<Settings>) };
      return settings;
    },
    'analytics:summary': () => ({
      activeMs: 8 * H,
      idleMs: 1.6 * H,
      productiveMs: 4.4 * H,
      neutralMs: 2.2 * H,
      distractingMs: 1.1 * H,
      uncategorizedMs: 0.3 * H,
      webMs: 3.3 * H,
    }),
    'analytics:apps': () =>
      apps.map((a) => ({
        appId: a.appId,
        exeName: a.exeName,
        displayName: a.displayName,
        categoryId: a.categoryId,
        categoryName: cat(a.categoryId)?.name ?? null,
        categoryKind: cat(a.categoryId)?.kind ?? null,
        color: cat(a.categoryId)?.color ?? null,
        ms: a.hours * H,
      })),
    'analytics:domains': () =>
      domains.map((d) => ({
        domainId: d.domainId,
        domain: d.domain,
        categoryId: d.categoryId,
        categoryName: cat(d.categoryId)?.name ?? null,
        categoryKind: cat(d.categoryId)?.kind ?? null,
        color: cat(d.categoryId)?.color ?? null,
        ms: d.hours * H,
      })),
    'analytics:categories': () =>
      categories.map((c, i) => ({
        categoryId: c.id,
        name: c.name,
        kind: c.kind,
        color: c.color,
        ms: (2.4 - i * 0.35) * H,
      })),
    'analytics:hourly': (p) => hourlyFor((p as { from: number }).from, (p as { to: number }).to),
    'analytics:daily': (p) => {
      const { from, to } = p as { from: number; to: number };
      const out = [];
      for (let t = from; t < to; t += DAY) {
        const w = 0.6 + 0.4 * Math.sin(t / DAY);
        out.push({
          dayStartTs: t,
          activeMs: w * 7 * H,
          productiveMs: w * 4 * H,
          distractingMs: w * 1.2 * H,
        });
      }
      return out;
    },
    'analytics:sessions': (p) => sessionsFor((p as { from: number }).from, (p as { to: number }).to),
    'analytics:webSessions': () => [],
    'analytics:insights': () => ({
      topApp: { name: 'Visual Studio Code', ms: 3.4 * H },
      topCategory: { name: 'Development', kind: 'productive', color: '#6366f1', ms: 3.9 * H },
      longestSession: { name: 'Visual Studio Code', ms: 52 * 60000, startTs: t0 + 9 * H },
      mostActiveDay: { dayStartTs: t0, ms: 8 * H },
      dailyAverageMs: 6.5 * H,
      activeDays: 5,
      distinctApps: apps.length,
      productivePct: 55,
      focusScore: 80,
    }),
    'apps:list': () =>
      apps.map((a) => ({ id: a.appId, exeName: a.exeName, displayName: a.displayName, exePath: null, categoryId: a.categoryId })),
    'domains:list': () => domains.map((d) => ({ id: d.domainId, domain: d.domain, categoryId: d.categoryId })),
    'categories:list': () => categories,
    'categories:create': (p) => {
      const o = p as { name: string; kind: Category['kind']; color: string };
      const c: Category = { id: categories.length + 1, ...o, isBuiltin: false };
      categories.push(c);
      return c;
    },
    'categories:update': () => undefined,
    'categories:delete': () => undefined,
    'categories:assign': () => undefined,
    'goals:list': () => goals,
    'goals:create': () => goals[0],
    'goals:update': () => undefined,
    'goals:delete': () => undefined,
    'focus:start': (p) => {
      const o = p as { plannedMinutes: number; blockedCategoryIds: number[] };
      focusSession = {
        id: 1,
        startTs: Date.now(),
        endTs: null,
        plannedMinutes: o.plannedMinutes,
        blockedCategoryIds: o.blockedCategoryIds,
        distractionSeconds: 0,
        warnings: 0,
      };
      return focusSession;
    },
    'focus:stop': () => {
      const s = focusSession;
      focusSession = null;
      return s;
    },
    'focus:status': () => ({
      session: focusSession,
      remainingSec: focusSession ? Math.max(0, Math.round((focusSession.startTs + focusSession.plannedMinutes * 60000 - Date.now()) / 1000)) : 0,
      currentlyDistracting: false,
    }),
    'focus:history': () => [
      { id: 9, startTs: now - 5 * H, endTs: now - 5 * H + 25 * 60000, plannedMinutes: 25, blockedCategoryIds: [5, 6], distractionSeconds: 0, warnings: 0 },
      { id: 8, startTs: now - 26 * H, endTs: now - 26 * H + 45 * 60000, plannedMinutes: 45, blockedCategoryIds: [5], distractionSeconds: 240, warnings: 3 },
    ],
    'tracking:status': () => ({
      paused: settings.trackingPaused,
      state: settings.trackingPaused ? 'stopped' : 'active',
      currentExe: 'code',
      currentTitle: null,
      sinceTs: now - 12 * 60000,
    }),
    'tracking:setPaused': (p) => {
      settings.trackingPaused = (p as { paused: boolean }).paused;
      return handlers['tracking:status']!();
    },
    'data:export': () => ({ savedTo: 'C:\\mock\\export.json' }),
    'data:delete': () => ({ deletedRows: 1234 }),
    'onboarding:complete': (p) => {
      settings = { ...settings, onboardingDone: true, ...(p as object) };
      return settings;
    },
    'system:info': () => ({ version: '0.1.0-mock', dataDir: 'C:\\Users\\you\\AppData\\Roaming\\TimeScope' }),
    'system:openDataDir': () => ({ opened: true }),
    'system:restart': () => undefined,
  };

  window.timescope = {
    invoke: (channel: string, payload?: unknown) => {
      const h = handlers[channel];
      return h ? Promise.resolve(h(payload)) : Promise.reject(new Error(`mock: no handler for ${channel}`));
    },
    onStateChanged: () => () => {},
  };
}
