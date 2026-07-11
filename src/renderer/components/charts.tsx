/** Chart components (Recharts) using the validated palette roles from styles.css. */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtDuration } from '../api';
import type { CategoryUsage, DayBucket, HourBucket } from '../../shared/types';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

interface TooltipRow {
  name: string;
  color: string;
  ms: number;
}

function TooltipBox(props: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="tooltip-box">
      <div className="t-title">{props.title}</div>
      {props.rows.map((r) => (
        <div className="t-row" key={r.name}>
          <i style={{ background: r.color }} />
          <span>{r.name}</span>
          <strong style={{ marginLeft: 'auto', paddingLeft: 12 }}>{fmtDuration(r.ms)}</strong>
        </div>
      ))}
    </div>
  );
}

function Legend(props: { keys: { name: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {props.keys.map((k) => (
        <span className="key" key={k.name}>
          <i style={{ background: k.color }} />
          {k.name}
        </span>
      ))}
    </div>
  );
}

const hourLabel = (ts: number): string => {
  const h = new Date(ts).getHours();
  return h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
};

const minTick = (ms: number): string => `${Math.round(ms / 60000)}m`;

/** Hour-by-hour stacked composition: productive / distracting / other active. */
export function HourlyChart(props: { data: HourBucket[] }) {
  const cProd = cssVar('--series-productive');
  const cDist = cssVar('--series-distracting');
  const cOther = cssVar('--series-active');
  const rows = props.data.map((b) => ({
    ts: b.hourStartTs,
    productive: b.productiveMs,
    distracting: b.distractingMs,
    other: Math.max(0, b.activeMs - b.productiveMs - b.distractingMs),
  }));
  return (
    <div>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={cssVar('--grid')} />
            <XAxis
              dataKey="ts"
              tickFormatter={hourLabel}
              tick={{ fill: cssVar('--muted'), fontSize: 11 }}
              stroke={cssVar('--baseline')}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tickFormatter={minTick}
              tick={{ fill: cssVar('--muted'), fontSize: 11 }}
              stroke="transparent"
              tickLine={false}
              width={54}
            />
            <Tooltip
              cursor={{ fill: 'rgba(128,128,128,0.08)' }}
              content={({ active, payload, label }) =>
                active && payload && payload.length ? (
                  <TooltipBox
                    title={`${hourLabel(Number(label))} – ${hourLabel(Number(label) + 3_600_000)}`}
                    rows={[
                      { name: 'Productive', color: cProd, ms: Number(payload.find((p) => p.dataKey === 'productive')?.value ?? 0) },
                      { name: 'Other active', color: cOther, ms: Number(payload.find((p) => p.dataKey === 'other')?.value ?? 0) },
                      { name: 'Distracting', color: cDist, ms: Number(payload.find((p) => p.dataKey === 'distracting')?.value ?? 0) },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="productive" stackId="a" fill={cProd} />
            <Bar dataKey="other" stackId="a" fill={cOther} />
            <Bar dataKey="distracting" stackId="a" fill={cDist} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend
        keys={[
          { name: 'Productive', color: cProd },
          { name: 'Other active', color: cOther },
          { name: 'Distracting', color: cDist },
        ]}
      />
    </div>
  );
}

export function DailyTrendChart(props: { data: DayBucket[] }) {
  const cActive = cssVar('--series-active');
  const cProd = cssVar('--series-productive');
  const rows = props.data.map((b) => ({ ts: b.dayStartTs, active: b.activeMs, productive: b.productiveMs }));
  const dayLabel = (ts: number): string => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <div>
      <div className="chart-wrap">
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cActive} stopOpacity={0.25} />
                <stop offset="100%" stopColor={cActive} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={cssVar('--grid')} />
            <XAxis
              dataKey="ts"
              tickFormatter={dayLabel}
              tick={{ fill: cssVar('--muted'), fontSize: 11 }}
              stroke={cssVar('--baseline')}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v / 3_600_000)}h`}
              tick={{ fill: cssVar('--muted'), fontSize: 11 }}
              stroke="transparent"
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload && payload.length ? (
                  <TooltipBox
                    title={dayLabel(Number(label))}
                    rows={[
                      { name: 'Active', color: cActive, ms: Number(payload.find((p) => p.dataKey === 'active')?.value ?? 0) },
                      { name: 'Productive', color: cProd, ms: Number(payload.find((p) => p.dataKey === 'productive')?.value ?? 0) },
                    ]}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="active" stroke={cActive} strokeWidth={2} fill="url(#gActive)" />
            <Area type="monotone" dataKey="productive" stroke={cProd} strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Legend
        keys={[
          { name: 'Active', color: cActive },
          { name: 'Productive', color: cProd },
        ]}
      />
    </div>
  );
}

/** Time by category — donut with the category's own (entity) colors. */
export function CategoryDonut(props: { data: CategoryUsage[] }) {
  const fallback = cssVar('--series-idle');
  const surface = cssVar('--surface');
  const total = props.data.reduce((s, c) => s + c.ms, 0);
  if (total === 0) return <div className="empty">No categorized activity yet.</div>;
  const rows = props.data.slice(0, 8);
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 180, height: 180, flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={rows}
              dataKey="ms"
              nameKey="name"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={2}
              stroke={surface}
              strokeWidth={2}
            >
              {rows.map((c) => (
                <Cell key={c.name} fill={c.color ?? fallback} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <TooltipBox
                    title={String(payload[0]?.name ?? '')}
                    rows={[
                      {
                        name: `${Math.round((Number(payload[0]?.value ?? 0) / total) * 100)}% of active time`,
                        color: (payload[0]?.payload as CategoryUsage)?.color ?? fallback,
                        ms: Number(payload[0]?.value ?? 0),
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        {rows.map((c) => (
          <div className="row" key={c.name}>
            <span className="cat-chip">
              <span className="swatch" style={{ background: c.color ?? fallback }} />
              {c.name}
            </span>
            <div className="usage-bar">
              <div style={{ width: `${(c.ms / total) * 100}%`, background: c.color ?? fallback }} />
            </div>
            <span className="row-value">{fmtDuration(c.ms)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal usage list (apps / websites) with proportional bars. */
export function UsageList(props: {
  items: { name: string; sub?: string; ms: number; color: string | null }[];
  emptyText: string;
  max?: number;
}) {
  const items = props.items.slice(0, props.max ?? 8);
  if (items.length === 0) return <div className="empty">{props.emptyText}</div>;
  const top = items[0]?.ms ?? 1;
  const fallback = cssVar('--series-active');
  return (
    <div>
      {items.map((it) => (
        <div className="row" key={it.name + (it.sub ?? '')}>
          <div className="row-name">
            {it.name}
            {it.sub ? <span className="row-sub"> · {it.sub}</span> : null}
          </div>
          <div className="usage-bar">
            <div style={{ width: `${Math.max(2, (it.ms / top) * 100)}%`, background: it.color ?? fallback }} />
          </div>
          <span className="row-value">{fmtDuration(it.ms)}</span>
        </div>
      ))}
    </div>
  );
}
