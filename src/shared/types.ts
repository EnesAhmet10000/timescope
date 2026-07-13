/** Shared types between main, preload and renderer. Times are unix epoch milliseconds. */

export type CategoryKind = 'productive' | 'neutral' | 'distracting';
export type IdleKind = 'idle' | 'locked' | 'suspend';
export type Theme = 'system' | 'light' | 'dark';
export type Language = 'en' | 'ar' | 'tr';
export type TargetType = 'app' | 'domain';

export interface Settings {
  onboardingDone: boolean;
  trackingPaused: boolean;
  idleThresholdSec: number;
  trackWindowTitles: boolean;
  trackWebsites: boolean;
  startWithWindows: boolean;
  retentionDays: number; // 0 = keep forever
  excludedApps: string[]; // exe names, lowercase
  excludedDomains: string[]; // domains, lowercase
  theme: Theme;
  language: Language;
  extensionPort: number;
  extensionToken: string;
}

export interface AppRow {
  id: number;
  exeName: string;
  displayName: string;
  exePath: string | null;
  categoryId: number | null;
}

export interface DomainRow {
  id: number;
  domain: string;
  categoryId: number | null;
}

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  color: string;
  isBuiltin: boolean;
}

export interface SessionRow {
  id: number;
  appId: number;
  exeName: string;
  displayName: string;
  title: string | null;
  startTs: number;
  endTs: number;
  categoryId: number | null;
  categoryKind: CategoryKind | null;
}

export interface WebSessionRow {
  id: number;
  domainId: number;
  domain: string;
  startTs: number;
  endTs: number;
  categoryId: number | null;
  categoryKind: CategoryKind | null;
}

export interface IdleRow {
  id: number;
  kind: IdleKind;
  startTs: number;
  endTs: number;
}

export interface Goal {
  id: number;
  name: string;
  categoryId: number;
  comparator: 'at_most' | 'at_least';
  minutesPerDay: number;
  active: boolean;
}

export interface GoalProgress extends Goal {
  categoryName: string;
  categoryKind: CategoryKind;
  minutesToday: number;
}

export interface FocusSession {
  id: number;
  startTs: number;
  endTs: number | null;
  plannedMinutes: number;
  blockedCategoryIds: number[];
  distractionSeconds: number;
  warnings: number;
}

export interface Range {
  from: number;
  to: number;
}

export interface Summary {
  activeMs: number;
  idleMs: number;
  productiveMs: number;
  neutralMs: number;
  distractingMs: number;
  uncategorizedMs: number;
  webMs: number;
}

export interface AppUsage {
  appId: number;
  exeName: string;
  displayName: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryKind: CategoryKind | null;
  color: string | null;
  ms: number;
}

export interface DomainUsage {
  domainId: number;
  domain: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryKind: CategoryKind | null;
  color: string | null;
  ms: number;
}

export interface CategoryUsage {
  categoryId: number | null;
  name: string;
  kind: CategoryKind | null;
  color: string | null;
  ms: number;
}

export interface HourBucket {
  hourStartTs: number;
  activeMs: number;
  productiveMs: number;
  distractingMs: number;
  idleMs: number;
}

export interface DayBucket {
  dayStartTs: number;
  activeMs: number;
  productiveMs: number;
  distractingMs: number;
}

export interface TrackingStatus {
  paused: boolean;
  state: 'active' | 'idle' | 'stopped';
  currentExe: string | null;
  currentTitle: string | null;
  sinceTs: number | null;
}

export interface Insights {
  topApp: { name: string; ms: number } | null;
  topCategory: { name: string; kind: CategoryKind | null; color: string | null; ms: number } | null;
  longestSession: { name: string; ms: number; startTs: number } | null;
  mostActiveDay: { dayStartTs: number; ms: number } | null;
  dailyAverageMs: number;
  activeDays: number;
  distinctApps: number;
  productivePct: number;
  focusScore: number;
}

export interface FocusStatus {
  session: FocusSession | null;
  remainingSec: number;
  currentlyDistracting: boolean;
}

export type DeleteMode = 'range' | 'web' | 'apps' | 'all';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  notes?: string;
  downloadUrl?: string;
  downloadedPath?: string;
  progress?: number;
  error?: string;
  canInstall: boolean;
}

/** Renderer -> main IPC surface (all via ipcRenderer.invoke). */
export interface IpcApi {
  'settings:get': { req: void; res: Settings };
  'settings:update': { req: Partial<Settings>; res: Settings };
  'analytics:summary': { req: Range; res: Summary };
  'analytics:apps': { req: Range; res: AppUsage[] };
  'analytics:domains': { req: Range; res: DomainUsage[] };
  'analytics:categories': { req: Range; res: CategoryUsage[] };
  'analytics:hourly': { req: Range; res: HourBucket[] };
  'analytics:daily': { req: Range; res: DayBucket[] };
  'analytics:sessions': { req: Range; res: SessionRow[] };
  'analytics:webSessions': { req: Range; res: WebSessionRow[] };
  'analytics:insights': { req: Range; res: Insights };
  'apps:list': { req: void; res: AppRow[] };
  'domains:list': { req: void; res: DomainRow[] };
  'categories:list': { req: void; res: Category[] };
  'categories:create': { req: { name: string; kind: CategoryKind; color: string }; res: Category };
  'categories:update': { req: { id: number; name?: string; kind?: CategoryKind; color?: string }; res: void };
  'categories:delete': { req: { id: number }; res: void };
  'categories:assign': { req: { targetType: TargetType; targetId: number; categoryId: number | null }; res: void };
  'goals:list': { req: void; res: GoalProgress[] };
  'goals:create': { req: Omit<Goal, 'id'>; res: Goal };
  'goals:update': { req: Partial<Goal> & { id: number }; res: void };
  'goals:delete': { req: { id: number }; res: void };
  'focus:start': { req: { plannedMinutes: number; blockedCategoryIds: number[] }; res: FocusSession };
  'focus:stop': { req: void; res: FocusSession | null };
  'focus:status': { req: void; res: FocusStatus };
  'focus:history': { req: void; res: FocusSession[] };
  'tracking:status': { req: void; res: TrackingStatus };
  'tracking:setPaused': { req: { paused: boolean }; res: TrackingStatus };
  'data:export': { req: { format: 'csv' | 'json'; from: number; to: number }; res: { savedTo: string | null } };
  'data:delete': { req: { mode: DeleteMode; from?: number; to?: number }; res: { deletedRows: number } };
  'onboarding:complete': { req: { trackWindowTitles: boolean; trackWebsites: boolean }; res: Settings };
  'system:info': { req: void; res: { version: string; dataDir: string } };
  'system:openDataDir': { req: void; res: { opened: boolean } };
  'system:restart': { req: void; res: void };
  'update:state': { req: void; res: UpdateInfo };
  'update:check': { req: void; res: UpdateInfo };
  'update:download': { req: void; res: UpdateInfo };
  'update:install': { req: void; res: void };
}

export type IpcChannel = keyof IpcApi;
