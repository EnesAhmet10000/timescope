import { useState } from 'react';
import { invoke, fmtDuration } from '../api';
import { Card, ConfirmModal, Modal, usePolled } from '../components/common';
import type { GoalProgress } from '../../shared/types';

function GoalEditor(props: { onSave: () => void; onClose: () => void }) {
  const categories = usePolled(() => invoke('categories:list'), []);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [comparator, setComparator] = useState<'at_most' | 'at_least'>('at_most');
  const [minutes, setMinutes] = useState(60);

  const save = async (): Promise<void> => {
    if (!categoryId) return;
    const catName = categories?.find((c) => c.id === categoryId)?.name ?? '';
    await invoke('goals:create', {
      name: name.trim() || `${comparator === 'at_most' ? 'Less than' : 'At least'} ${fmtDuration(minutes * 60000)} of ${catName} per day`,
      categoryId,
      comparator,
      minutesPerDay: minutes,
      active: true,
    });
    props.onSave();
    props.onClose();
  };

  return (
    <Modal title="New goal" onClose={props.onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <label>
          <div className="setting-label" style={{ marginBottom: 4 }}>Name (optional)</div>
          <input
            type="text"
            value={name}
            placeholder="e.g. Less social media"
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={comparator} onChange={(e) => setComparator(e.target.value as 'at_most' | 'at_least')}>
            <option value="at_most">Spend less than</option>
            <option value="at_least">Spend at least</option>
          </select>
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            style={{ width: 84 }}
          />
          <span style={{ color: 'var(--muted)' }}>minutes/day on</span>
          <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Select category…</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>Cancel</button>
        <button className="btn primary" disabled={!categoryId} onClick={() => void save()}>
          Create goal
        </button>
      </div>
    </Modal>
  );
}

function GoalRow(props: { g: GoalProgress; onChanged: () => void; onDelete: () => void }) {
  const { g } = props;
  const pct = Math.min(100, (g.minutesToday / g.minutesPerDay) * 100);
  const met = g.comparator === 'at_most' ? g.minutesToday <= g.minutesPerDay : g.minutesToday >= g.minutesPerDay;
  const barColor =
    g.comparator === 'at_most'
      ? pct < 80
        ? 'var(--series-productive)'
        : pct < 100
          ? 'var(--series-neutral)'
          : 'var(--series-distracting)'
      : met
        ? 'var(--series-productive)'
        : 'var(--series-active)';

  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-name">{g.name}</div>
        <div className="row-sub">
          {g.categoryName} · {g.minutesToday}m of {g.minutesPerDay}m today ·{' '}
          <span style={{ color: met ? 'var(--good)' : 'var(--critical)', fontWeight: 600 }}>
            {met ? 'on track' : g.comparator === 'at_most' ? 'over limit' : 'behind'}
          </span>
        </div>
        <div className="usage-bar" style={{ maxWidth: 'none', marginTop: 6 }}>
          <div style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      <button className="btn danger" onClick={props.onDelete}>
        Delete
      </button>
    </div>
  );
}

export function Goals() {
  const [bump, setBump] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<GoalProgress | null>(null);
  const goals = usePolled(() => invoke('goals:list'), [bump], 30000);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Goals</h1>
          <div className="page-sub">Daily targets per category, with live progress.</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + New goal
        </button>
      </div>
      <Card>
        {(goals ?? []).length === 0 ? (
          <div className="empty">
            No goals yet. Try “Spend less than 1 hour per day on Social Media” or “At least 3 hours on Development”.
          </div>
        ) : (
          (goals ?? []).map((g) => (
            <GoalRow key={g.id} g={g} onChanged={() => setBump((b) => b + 1)} onDelete={() => setDeleting(g)} />
          ))
        )}
      </Card>
      {creating ? <GoalEditor onSave={() => setBump((b) => b + 1)} onClose={() => setCreating(false)} /> : null}
      {deleting ? (
        <ConfirmModal
          title={`Delete goal "${deleting.name}"?`}
          message="This only removes the goal, not any tracked time."
          confirmLabel="Delete goal"
          danger
          onConfirm={() => void invoke('goals:delete', { id: deleting.id }).then(() => setBump((b) => b + 1))}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
