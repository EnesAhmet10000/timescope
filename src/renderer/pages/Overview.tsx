import { invoke, fmtDuration, type View } from '../api';
import { Card, RangePicker, StatCard, usePolled } from '../components/common';
import { CategoryDonut, DailyTrendChart, HourlyChart, UsageList } from '../components/charts';
import type { Range } from '../../shared/types';

export function Overview(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { range, view } = props;
  const key = [range.from, range.to];
  const summary = usePolled(() => invoke('analytics:summary', range), key);
  const apps = usePolled(() => invoke('analytics:apps', range), key);
  const domains = usePolled(() => invoke('analytics:domains', range), key);
  const categories = usePolled(() => invoke('analytics:categories', range), key);
  const hourly = usePolled(() => invoke('analytics:hourly', range), key);
  const daily = usePolled(() => invoke('analytics:daily', range), key);

  const multiDay = range.to - range.from > 26 * 3_600_000;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <div className="page-sub">Where your time went — all data stays on this computer.</div>
        </div>
        <RangePicker view={view} range={range} onChange={props.onRange} />
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 16 }}>
        <StatCard label="Active time" value={fmtDuration(summary?.activeMs ?? 0)} color="var(--series-active)" />
        <StatCard label="Productive" value={fmtDuration(summary?.productiveMs ?? 0)} color="var(--series-productive)" />
        <StatCard
          label="Distracting"
          value={fmtDuration(summary?.distractingMs ?? 0)}
          color="var(--series-distracting)"
        />
        <StatCard label="Idle / away" value={fmtDuration(summary?.idleMs ?? 0)} color="var(--series-idle)" />
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        {multiDay ? (
          <Card title="Daily activity trend">
            <DailyTrendChart data={daily ?? []} />
          </Card>
        ) : (
          <Card title="Hour-by-hour timeline">
            <HourlyChart data={hourly ?? []} />
          </Card>
        )}
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title="Top applications">
          <UsageList
            emptyText="No app activity recorded in this period yet."
            items={(apps ?? []).map((a) => ({
              name: a.displayName,
              sub: a.categoryName ?? undefined,
              ms: a.ms,
              color: a.color,
            }))}
          />
        </Card>
        <Card title="Top websites">
          <UsageList
            emptyText="No website activity. Enable website tracking in Settings and install the browser extension."
            items={(domains ?? []).map((d) => ({
              name: d.domain,
              sub: d.categoryName ?? undefined,
              ms: d.ms,
              color: d.color,
            }))}
          />
        </Card>
      </div>

      <div className="grid">
        <Card title="Time by category">
          <CategoryDonut data={categories ?? []} />
        </Card>
      </div>
    </>
  );
}
