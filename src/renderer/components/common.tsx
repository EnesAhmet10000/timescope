import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fromDateInputValue, getRange, toDateInputValue, type View } from '../api';
import { useT } from '../i18n';
import type { Range } from '../../shared/types';

export function Card(props: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`card ${props.className ?? ''}`}>
      {props.title ? <p className="card-title">{props.title}</p> : null}
      {props.children}
    </div>
  );
}

export function StatCard(props: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="card">
      <div className="stat-accent" style={{ background: props.color }} />
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}</div>
      {props.sub ? <div className="row-sub">{props.sub}</div> : null}
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={props.checked}
        aria-label={props.ariaLabel}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="knob" />
    </label>
  );
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {props.options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === props.value}
          className={o.value === props.value ? 'active' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal(props: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal" role="dialog" aria-label={props.title}>
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </div>
  );
}

export function ConfirmModal(props: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <p style={{ color: 'var(--ink-2)' }}>{props.message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>
          {t('common.cancel')}
        </button>
        <button
          className={`btn ${props.danger ? 'danger' : 'primary'}`}
          onClick={() => {
            props.onConfirm();
            props.onClose();
          }}
        >
          {props.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const VIEW_VALUES: View[] = ['today', 'yesterday', '7d', '30d', 'custom'];
const VIEW_TKEY: Record<View, string> = {
  today: 'range.today',
  yesterday: 'range.yesterday',
  '7d': 'range.7d',
  '30d': 'range.30d',
  custom: 'range.custom',
};

export function RangePicker(props: { view: View; range: Range; onChange: (view: View, range: Range) => void }) {
  const { t } = useT();
  const options = VIEW_VALUES.map((v) => ({ value: v, label: t(VIEW_TKEY[v]) }));
  const setView = (v: View): void => {
    if (v === 'custom') {
      props.onChange(v, props.range);
    } else {
      props.onChange(v, getRange(v));
    }
  };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Segmented options={options} value={props.view} onChange={setView} />
      {props.view === 'custom' ? (
        <>
          <input
            type="date"
            value={toDateInputValue(props.range.from)}
            onChange={(e) =>
              e.target.value && props.onChange('custom', { ...props.range, from: fromDateInputValue(e.target.value) })
            }
          />
          <span style={{ color: 'var(--muted)' }}>{t('range.to')}</span>
          <input
            type="date"
            value={toDateInputValue(props.range.to)}
            onChange={(e) =>
              e.target.value &&
              props.onChange('custom', { ...props.range, to: fromDateInputValue(e.target.value) + 86_400_000 })
            }
          />
        </>
      ) : null}
    </div>
  );
}

/** Poll-based data hook: refetches when deps change and every `intervalMs`. */
export function usePolled<T>(fetcher: () => Promise<T>, deps: unknown[], intervalMs = 15000): T | null {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => {
    fetcher()
      .then(setData)
      .catch((err) => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
    const t = setInterval(load, intervalMs);
    return () => clearInterval(t);
  }, [load, intervalMs]);
  return data;
}
