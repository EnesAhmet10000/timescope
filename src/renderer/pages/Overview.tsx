import { invoke, fmtDuration, fmtDate, type View } from '../api';
import { Card, RangePicker, StatCard, usePolled } from '../components/common';
import { CategoryDonut, DailyTrendChart, HourlyChart, UsageList } from '../components/charts';
import type { Insights, Range } from '../../shared/types';

function InsightTile(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="insight-tile">
      <div className="insight-label">{props.label}</div>
      <div className="insight-value">{props.value}</div>
      {props.sub ? <div className="insight-sub">{props.sub}</div> : null}
    </div>
  );
}

function InsightsSection(props: { data: Insights | null; multiDay: boolean }) {
  const i = props.data;
  return (
    <div className="insight-grid">
      <InsightTile
        label="Most used app"
        value={i?.topApp ? i.topApp.name : '—'}
        sub={i?.topApp ? fmtDuration(i.topApp.ms) : 'No activity yet'}
      />
      <InsightTile
        label="Top category"
        value={i?.topCategory ? i.topCategory.name : '—'}
        sub={i?.topCategory ? fmtDuration(i.topCategory.ms) : 'Uncategorized'}
      />
      <InsightTile
        label="Longest focus stretch"
        value={i?.longestSession ? fmtDuration(i.longestSession.ms) : '—'}
        sub={i?.longestSession ? i.longestSession.name : undefined}
      />
      <InsightTile label="Productive share" value={`${i?.productivePct ?? 0}%`} sub="of active time" />
      {props.multiDay ? (
        <>
          <InsightTile
            label="Daily average"
            value={fmtDuration(i?.dailyAverageMs ?? 0)}
            sub={`${i?.activeDays ?? 0} active day${(i?.activeDays ?? 0) === 1 ? '' : 's'}`}
          />
          <InsightTile
            label="Most active day"
            value={i?.mostActiveDay ? fmtDate(i.mostActiveDay.dayStartTs) : '—'}
            sub={i?.mostActiveDay ? fmtDuration(i.mostActiveDay.ms) : undefined}
          />
        </>
      ) : (
        <InsightTile label="Apps used" value={String(i?.distinctApps ?? 0)} sub="different applications" />
      )}
    </div>
  );
}

export function Overview(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { range, view } = props;
  const key = [range.from, range.to];
  const summary = usePolled(() => invoke('analytics:summary', range), key);
  const apps = usePolled(() => invoke('analytics:apps', range), key);
  const domains = usePolled(() => invoke('analytics:domains', range), key);
  const categories = usePolled(() => invoke('analytics:categories', range), key);
  const hourly = usePolled(() => invoke('analytics:hourly', range), key);
  const daily = usePolled(() => invoke('analytics:daily', range), key);
  const insightsData = usePolled(() => invoke('analytics:insights', range), key);

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

      <div className="grid" style={{ marginBottom: 16 }}>
        <Card title="Insights">
          <InsightsSection data={insightsData} multiDay={multiDay} />
        </Card>
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
