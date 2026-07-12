import { describe, expect, it } from 'vitest';
import { Tracker, MERGE_GAP_MS } from '../src/main/tracker';
import { makeCtx, type TestCtx } from './helpers';
import type { ForegroundInfo } from '../src/main/win32';

/** Test harness with a controllable clock, foreground app, and idle time. */
function makeTracker(ctx: TestCtx) {
  const state = {
    now: 1_000_000_000,
    fg: { exeName: 'code', exePath: 'C:\\code.exe', title: 'main.ts — project' } as ForegroundInfo | null,
    idleSec: 0,
  };
  const tracker = new Tracker(ctx.db, ctx.catalog, ctx.settings, {
    now: () => state.now,
    getForeground: () => state.fg,
    getIdleSec: () => state.idleSec,
  });
  const advance = (ms: number): void => {
    state.now += ms;
  };
  return { tracker, state, advance };
}

function sessions(ctx: TestCtx) {
  return ctx.db.all<{ id: number; app_id: number; title: string | null; start_ts: number; end_ts: number }>(
    'SELECT * FROM sessions ORDER BY start_ts',
  );
}

function idles(ctx: TestCtx) {
  return ctx.db.all<{ kind: string; start_ts: number; end_ts: number }>('SELECT * FROM idle_periods ORDER BY start_ts');
}

describe('Tracker', () => {
  it('groups continuous activity in one app into a single session row', () => {
    const ctx = makeCtx();
    const { tracker, advance } = makeTracker(ctx);
    for (let i = 0; i < 10; i++) {
      tracker.poll();
      advance(2000);
    }
    const rows = sessions(ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.end_ts - rows[0]!.start_ts).toBe(18_000);
  });

  it('starts a new session when the app changes', () => {
    const ctx = makeCtx();
    const { tracker, state, advance } = makeTracker(ctx);
    tracker.poll();
    advance(4000);
    tracker.poll();
    state.fg = { exeName: 'chrome', exePath: null, title: 'x' };
    advance(2000);
    tracker.poll();
    advance(4000);
    tracker.poll();
    const rows = sessions(ctx);
    expect(rows).toHaveLength(2);
  });

  it('merges a quick alt-tab away and back into the previous row', () => {
    const ctx = makeCtx();
    const { tracker, state, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll(); // code: 10s
    state.fg = { exeName: 'chrome', exePath: null, title: '' };
    advance(2000);
    tracker.poll(); // chrome briefly (will be a <1s sliver? chrome session lasts one poll)
    state.fg = { exeName: 'code', exePath: 'C:\\code.exe', title: 'x' };
    advance(2000);
    tracker.poll(); // back to code within MERGE_GAP_MS
    advance(10_000);
    tracker.poll();
    const rows = sessions(ctx);
    const codeAppId = ctx.catalog.ensureApp('code', null);
    const codeRows = rows.filter((r) => r.app_id === codeAppId);
    expect(codeRows).toHaveLength(1); // merged, not duplicated
    expect(codeRows[0]!.end_ts - codeRows[0]!.start_ts).toBe(24_000);
  });

  it('detects idle retroactively and truncates the session to when input stopped', () => {
    const ctx = makeCtx();
    ctx.settings.update({ idleThresholdSec: 300 });
    const { tracker, state, advance } = makeTracker(ctx);
    const start = 1_000_000_000;
    tracker.poll();
    advance(60_000); // 60s of real activity
    tracker.poll();
    // input stops here; threshold is crossed 300s later
    advance(300_000);
    state.idleSec = 300;
    tracker.poll();
    const s = sessions(ctx);
    const i = idles(ctx);
    expect(s).toHaveLength(1);
    expect(i).toHaveLength(1);
    // Session is truncated to when input actually stopped, not when the threshold fired.
    expect(s[0]!.end_ts).toBe(start + 60_000);
    expect(i[0]!.start_ts).toBe(start + 60_000);
  });

  it('resumes tracking when the user returns from idle', () => {
    const ctx = makeCtx();
    ctx.settings.update({ idleThresholdSec: 60 });
    const { tracker, state, advance } = makeTracker(ctx);
    tracker.poll();
    advance(30_000); // 30s of real activity
    tracker.poll();
    advance(120_000);
    state.idleSec = 120;
    tracker.poll(); // -> idle (backdated to when input stopped)
    advance(60_000);
    state.idleSec = 0; // user is back
    tracker.poll();
    advance(10_000);
    tracker.poll();
    expect(sessions(ctx)).toHaveLength(2);
    const i = idles(ctx);
    expect(i).toHaveLength(1);
    expect(i[0]!.end_ts).toBeGreaterThan(i[0]!.start_ts);
  });

  it('records nothing while paused', () => {
    const ctx = makeCtx();
    ctx.settings.update({ trackingPaused: true });
    const { tracker, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll();
    expect(sessions(ctx)).toHaveLength(0);
  });

  it('skips excluded applications', () => {
    const ctx = makeCtx();
    ctx.settings.update({ excludedApps: ['code'] });
    const { tracker, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll();
    expect(sessions(ctx)).toHaveLength(0);
  });

  it('omits window titles unless enabled', () => {
    const ctx = makeCtx();
    const { tracker, advance } = makeTracker(ctx);
    tracker.poll();
    advance(5000);
    tracker.poll();
    expect(sessions(ctx)[0]!.title).toBeNull();

    ctx.settings.update({ trackWindowTitles: true });
    advance(5000);
    tracker.poll();
    expect(sessions(ctx)[0]!.title).toBe('main.ts — project');
  });

  it('lock screen force-closes the session and opens a locked idle period', () => {
    const ctx = makeCtx();
    const { tracker, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll();
    advance(2000);
    tracker.forceIdle('locked');
    advance(30_000);
    tracker.resumeFromForcedIdle();
    tracker.poll();
    const i = idles(ctx);
    expect(i).toHaveLength(1);
    expect(i[0]!.kind).toBe('locked');
    expect(i[0]!.end_ts - i[0]!.start_ts).toBe(30_000);
    expect(sessions(ctx)).toHaveLength(2); // one before lock, one after
  });

  it('self-heals when a resume event is missed after suspend', () => {
    const ctx = makeCtx();
    ctx.settings.update({ idleThresholdSec: 300 });
    const { tracker, state, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll();
    // System suspends. Normally 'resume' would call resumeFromForcedIdle(),
    // but simulate that event being dropped — it is never called.
    tracker.forceIdle('suspend');
    advance(60_000);
    // User is back at the keyboard (idle time is low) but no resume event fired.
    state.idleSec = 0;
    tracker.poll(); // should close the forced idle itself instead of wedging
    advance(10_000);
    tracker.poll();
    const i = idles(ctx);
    expect(i).toHaveLength(1);
    expect(i[0]!.kind).toBe('suspend');
    expect(i[0]!.end_ts).toBeGreaterThan(i[0]!.start_ts);
    // Tracking resumed: a new session is being recorded after the missed resume.
    expect(sessions(ctx).length).toBeGreaterThanOrEqual(2);
  });

  it('MERGE_GAP_MS bounds the merge window', () => {
    const ctx = makeCtx();
    const { tracker, state, advance } = makeTracker(ctx);
    tracker.poll();
    advance(10_000);
    tracker.poll();
    state.fg = null; // e.g. desktop focused
    advance(2000);
    tracker.poll(); // session closes here
    advance(MERGE_GAP_MS + 3000); // stay away longer than the merge window
    state.fg = { exeName: 'code', exePath: null, title: 'x' };
    tracker.poll();
    advance(10_000);
    tracker.poll();
    expect(sessions(ctx)).toHaveLength(2); // gap too large to merge
  });
});
