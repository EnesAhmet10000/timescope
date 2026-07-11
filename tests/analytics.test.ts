import { describe, expect, it } from 'vitest';
import { bucketize, byApp, byCategory, clippedMs, daily, hourly, summary, sumClipped } from '../src/main/analytics';
import { insertIdle, insertSession, makeCtx } from './helpers';

const T0 = new Date(2026, 5, 15, 0, 0, 0).getTime(); // local midnight
const H = 3_600_000;
const MIN = 60_000;

describe('clipping', () => {
  it('clips an interval to the range', () => {
    expect(clippedMs({ startTs: 0, endTs: 100 }, { from: 50, to: 80 })).toBe(30);
    expect(clippedMs({ startTs: 60, endTs: 70 }, { from: 50, to: 80 })).toBe(10);
    expect(clippedMs({ startTs: 0, endTs: 40 }, { from: 50, to: 80 })).toBe(0);
    expect(clippedMs({ startTs: 90, endTs: 120 }, { from: 50, to: 80 })).toBe(0);
  });

  it('sums multiple intervals', () => {
    const ivs = [
      { startTs: 0, endTs: 10 },
      { startTs: 20, endTs: 40 },
    ];
    expect(sumClipped(ivs, { from: 5, to: 30 })).toBe(5 + 10);
  });
});

describe('bucketize', () => {
  it('splits an interval across hour buckets', () => {
    const buckets = bucketize(
      [{ startTs: T0 + 30 * MIN, endTs: T0 + 90 * MIN }],
      { from: T0, to: T0 + 24 * H },
      H,
      T0,
    );
    expect(buckets.get(T0)).toBe(30 * MIN);
    expect(buckets.get(T0 + H)).toBe(30 * MIN);
  });

  it('clips to the range while bucketing', () => {
    const buckets = bucketize([{ startTs: T0 - H, endTs: T0 + H }], { from: T0, to: T0 + 24 * H }, H, T0);
    expect(buckets.get(T0)).toBe(H);
    expect(buckets.get(T0 - H)).toBeUndefined();
  });
});

describe('summary & aggregations', () => {
  it('computes active/idle and per-kind splits', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0 + 9 * H, T0 + 11 * H); // Development => productive
    insertSession(ctx, 'robloxplayerbeta', T0 + 12 * H, T0 + 13 * H); // Entertainment => distracting
    insertIdle(ctx, T0 + 11 * H, T0 + 12 * H);

    const s = summary(ctx.db, { from: T0, to: T0 + 24 * H });
    expect(s.activeMs).toBe(3 * H);
    expect(s.productiveMs).toBe(2 * H);
    expect(s.distractingMs).toBe(1 * H);
    expect(s.idleMs).toBe(1 * H);
  });

  it('byApp ranks apps by clipped time', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0, T0 + 2 * H);
    insertSession(ctx, 'chrome', T0, T0 + 1 * H);
    const rows = byApp(ctx.db, { from: T0 + 1 * H, to: T0 + 24 * H }); // clips chrome out entirely
    expect(rows).toHaveLength(1);
    expect(rows[0]?.exeName).toBe('code');
    expect(rows[0]?.ms).toBe(1 * H);
  });

  it('byCategory groups uncategorized separately', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'someunknownapp', T0, T0 + H);
    insertSession(ctx, 'code', T0, T0 + H);
    const rows = byCategory(ctx.db, { from: T0, to: T0 + 24 * H });
    const names = rows.map((r) => r.name).sort();
    expect(names).toContain('Uncategorized');
    expect(names).toContain('Development');
  });

  it('hourly returns aligned buckets covering the range', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0 + 9.5 * H, T0 + 10.25 * H);
    const buckets = hourly(ctx.db, { from: T0, to: T0 + 24 * H });
    expect(buckets).toHaveLength(24);
    expect(buckets[9]?.activeMs).toBe(0.5 * H);
    expect(buckets[10]?.activeMs).toBe(0.25 * H);
    expect(buckets[9]?.productiveMs).toBe(0.5 * H);
  });

  it('daily returns one bucket per day', () => {
    const ctx = makeCtx();
    insertSession(ctx, 'code', T0 + 10 * H, T0 + 12 * H);
    insertSession(ctx, 'code', T0 + 24 * H + 10 * H, T0 + 24 * H + 11 * H);
    const buckets = daily(ctx.db, { from: T0, to: T0 + 48 * H });
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.activeMs).toBe(2 * H);
    expect(buckets[1]?.activeMs).toBe(1 * H);
  });
});
