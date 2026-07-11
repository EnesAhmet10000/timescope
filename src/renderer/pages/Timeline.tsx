import { invoke, fmtClock, fmtDate, fmtDuration, type View } from '../api';
import { Card, RangePicker, usePolled } from '../components/common';
import { HourlyChart } from '../components/charts';
import type { Range } from '../../shared/types';

export function Timeline(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { range, view } = props;
  const key = [range.from, range.to];
  const sessions = usePolled(() => invoke('analytics:sessions', range), key);
  const idle = usePolled(() => invoke('analytics:hourly', range), key);

  const rows = [...(sessions ?? [])].sort((a, b) => b.startTs - a.startTs).slice(0, 300);
  const multiDay = range.to - range.from > 26 * 3_600_000;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Timeline</h1>
          <div className="page-sub">Chronological record of focused applications.</div>
        </div>
        <RangePicker view={view} range={range} onChange={props.onRange} />
      </div>

      {!multiDay ? (
        <div className="grid" style={{ marginBottom: 16 }}>
          <Card title="Hour-by-hour">
            <HourlyChart data={idle ?? []} />
          </Card>
        </div>
      ) : null}

      <Card title={`Sessions (${rows.length}${rows.length === 300 ? ', newest 300' : ''})`}>
        {rows.length === 0 ? (
          <div className="empty">Nothing recorded in this period.</div>
        ) : (
          rows.map((s) => (
            <div className="row" key={s.id}>
              <span className="row-value" style={{ minWidth: 118 }}>
                {multiDay ? `${fmtDate(s.startTs)} ` : ''}
                {fmtClock(s.startTs)}–{fmtClock(s.endTs)}
              </span>
              <div className="row-name">
                {s.displayName}
                {s.title ? <span className="row-sub"> · {s.title}</span> : null}
              </div>
              <span className="row-value">{fmtDuration(s.endTs - s.startTs)}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
