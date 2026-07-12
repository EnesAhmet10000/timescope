import { invoke, fmtDuration, fmtDate, type View } from '../api';
import { Card, RangePicker, StatCard, usePolled } from '../components/common';
import { CategoryDonut, DailyTrendChart, HourlyChart, UsageList } from '../components/charts';
import { useT, type TFunc } from '../i18n';
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

function InsightsSection(props: { data: Insights | null; multiDay: boolean; t: TFunc }) {
  const { data: i, t } = props;
  const days = i?.activeDays ?? 0;
  return (
    <div className="insight-grid">
      <InsightTile
        label={t('insight.mostUsedApp')}
        value={i?.topApp ? i.topApp.name : '—'}
        sub={i?.topApp ? fmtDuration(i.topApp.ms) : t('insight.noActivity')}
      />
      <InsightTile
        label={t('insight.topCategory')}
        value={i?.topCategory ? i.topCategory.name : '—'}
        sub={i?.topCategory ? fmtDuration(i.topCategory.ms) : t('common.uncategorized')}
      />
      <InsightTile
        label={t('insight.longestStretch')}
        value={i?.longestSession ? fmtDuration(i.longestSession.ms) : '—'}
        sub={i?.longestSession ? i.longestSession.name : undefined}
      />
      <InsightTile label={t('insight.productiveShare')} value={`${i?.productivePct ?? 0}%`} sub={t('insight.ofActive')} />
      {props.multiDay ? (
        <>
          <InsightTile
            label={t('insight.dailyAverage')}
            value={fmtDuration(i?.dailyAverageMs ?? 0)}
            sub={t(days === 1 ? 'insight.activeDay' : 'insight.activeDays', { n: days })}
          />
          <InsightTile
            label={t('insight.mostActiveDay')}
            value={i?.mostActiveDay ? fmtDate(i.mostActiveDay.dayStartTs) : '—'}
            sub={i?.mostActiveDay ? fmtDuration(i.mostActiveDay.ms) : undefined}
          />
        </>
      ) : (
        <InsightTile label={t('insight.appsUsed')} value={String(i?.distinctApps ?? 0)} sub={t('insight.differentApps')} />
      )}
    </div>
  );
}

export function Overview(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { t } = useT();
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
          <h1 className="page-title">{t('overview.title')}</h1>
          <div className="page-sub">{t('overview.sub')}</div>
        </div>
        <RangePicker view={view} range={range} onChange={props.onRange} />
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 16 }}>
        <StatCard label={t('overview.activeTime')} value={fmtDuration(summary?.activeMs ?? 0)} color="var(--series-active)" />
        <StatCard label={t('overview.productive')} value={fmtDuration(summary?.productiveMs ?? 0)} color="var(--series-productive)" />
        <StatCard
          label={t('overview.distracting')}
          value={fmtDuration(summary?.distractingMs ?? 0)}
          color="var(--series-distracting)"
        />
        <StatCard label={t('overview.idle')} value={fmtDuration(summary?.idleMs ?? 0)} color="var(--series-idle)" />
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        {multiDay ? (
          <Card title={t('overview.dailyTrend')}>
            <DailyTrendChart data={daily ?? []} />
          </Card>
        ) : (
          <Card title={t('overview.hourly')}>
            <HourlyChart data={hourly ?? []} />
          </Card>
        )}
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <Card title={t('overview.insights')}>
          <InsightsSection data={insightsData} multiDay={multiDay} t={t} />
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('overview.topApps')}>
          <UsageList
            emptyText={t('overview.noApps')}
            items={(apps ?? []).map((a) => ({
              name: a.displayName,
              sub: a.categoryName ?? undefined,
              ms: a.ms,
              color: a.color,
            }))}
          />
        </Card>
        <Card title={t('overview.topSites')}>
          <UsageList
            emptyText={t('overview.noSites')}
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
        <Card title={t('overview.byCategory')}>
          <CategoryDonut data={categories ?? []} />
        </Card>
      </div>
    </>
  );
}
