import { useEffect, useState } from 'react';
import { invoke, fmtClock, fmtDate, fmtDuration } from '../api';
import { Card, usePolled } from '../components/common';

const PRESETS = [25, 45, 60];

export function Focus() {
  const [bump, setBump] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [customMin, setCustomMin] = useState('');
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const categories = usePolled(() => invoke('categories:list'), []);
  const status = usePolled(() => invoke('focus:status'), [bump], 1000);
  const history = usePolled(() => invoke('focus:history'), [bump], 30000);

  // Default the blocked set to all "distracting" categories once loaded.
  useEffect(() => {
    if (categories && selectedCats.length === 0) {
      setSelectedCats(categories.filter((c) => c.kind === 'distracting').map((c) => c.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const active = status?.session ?? null;

  const start = async (): Promise<void> => {
    const m = customMin ? Math.max(1, Number(customMin)) : minutes;
    await invoke('focus:start', { plannedMinutes: m, blockedCategoryIds: selectedCats });
    setBump((b) => b + 1);
  };

  const stop = async (): Promise<void> => {
    await invoke('focus:stop');
    setBump((b) => b + 1);
  };

  const mm = Math.floor((status?.remainingSec ?? 0) / 60);
  const ss = (status?.remainingSec ?? 0) % 60;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Focus</h1>
          <div className="page-sub">Timed sessions with warnings when you drift into distracting categories.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <Card title={active ? 'Focus session running' : 'Start a focus session'}>
          {active ? (
            <div className="focus-ring">
              <div
                className="focus-timer"
                style={{ color: status?.currentlyDistracting ? 'var(--series-distracting)' : 'var(--ink)' }}
              >
                {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
              </div>
              <div className="row-sub" style={{ marginBottom: 16 }}>
                {status?.currentlyDistracting
                  ? '⚠ You are in a distracting category right now'
                  : `Planned ${active.plannedMinutes} min · ${active.warnings} warning${active.warnings === 1 ? '' : 's'} so far`}
              </div>
              <button className="btn danger" onClick={() => void stop()}>
                End session early
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    className={`btn ${minutes === p && !customMin ? 'primary' : ''}`}
                    onClick={() => {
                      setMinutes(p);
                      setCustomMin('');
                    }}
                  >
                    {p} min
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom"
                  min={1}
                  max={480}
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  style={{ width: 90 }}
                />
              </div>
              <div className="setting-label" style={{ marginBottom: 8 }}>Warn me about:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {(categories ?? []).map((c) => {
                  const on = selectedCats.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className="cat-chip"
                      style={{
                        cursor: 'pointer',
                        border: on ? `1.5px solid ${c.color}` : '1.5px solid transparent',
                        opacity: on ? 1 : 0.55,
                      }}
                      onClick={() =>
                        setSelectedCats((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                      }
                    >
                      <span className="swatch" style={{ background: c.color }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <button className="btn primary" onClick={() => void start()}>
                Start focus session
              </button>
            </>
          )}
        </Card>

        <Card title="Recent sessions">
          {(history ?? []).length === 0 ? (
            <div className="empty">No focus sessions yet.</div>
          ) : (
            (history ?? []).slice(0, 12).map((f) => (
              <div className="row" key={f.id}>
                <div className="row-name">
                  {fmtDate(f.startTs)} {fmtClock(f.startTs)}
                  <span className="row-sub">
                    {' '}· planned {f.plannedMinutes}m
                    {f.endTs ? ` · actual ${fmtDuration(f.endTs - f.startTs)}` : ' · running'}
                  </span>
                </div>
                <span
                  className="row-value"
                  style={{ color: f.distractionSeconds > 60 ? 'var(--series-distracting)' : 'var(--good)' }}
                >
                  {f.distractionSeconds > 0 ? `${Math.round(f.distractionSeconds / 60)}m distracted` : 'clean'}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
