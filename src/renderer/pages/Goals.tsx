import { useState } from 'react';
import { invoke, fmtDuration } from '../api';
import { Card, ConfirmModal, Modal, usePolled } from '../components/common';
import { useT } from '../i18n';
import type { GoalProgress } from '../../shared/types';

function GoalEditor(props: { onSave: () => void; onClose: () => void }) {
  const { t } = useT();
  const categories = usePolled(() => invoke('categories:list'), []);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [comparator, setComparator] = useState<'at_most' | 'at_least'>('at_most');
  const [minutes, setMinutes] = useState(60);

  const save = async (): Promise<void> => {
    if (!categoryId) return;
    const catName = categories?.find((c) => c.id === categoryId)?.name ?? '';
    const autoName = `${comparator === 'at_most' ? t('goals.lessThan') : t('goals.atLeast')} ${fmtDuration(minutes * 60000)} ${t('goals.perDayOf', { cat: catName })}`;
    await invoke('goals:create', {
      name: name.trim() || autoName,
      categoryId,
      comparator,
      minutesPerDay: minutes,
      active: true,
    });
    props.onSave();
    props.onClose();
  };

  return (
    <Modal title={t('goals.newTitle')} onClose={props.onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <label>
          <div className="setting-label" style={{ marginBottom: 4 }}>{t('goals.nameOptional')}</div>
          <input
            type="text"
            value={name}
            placeholder={t('goals.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={comparator} onChange={(e) => setComparator(e.target.value as 'at_most' | 'at_least')}>
            <option value="at_most">{t('goals.spendLess')}</option>
            <option value="at_least">{t('goals.spendAtLeast')}</option>
          </select>
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            style={{ width: 84 }}
          />
          <span style={{ color: 'var(--muted)' }}>{t('goals.minutesOn')}</span>
          <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('goals.selectCategory')}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!categoryId} onClick={() => void save()}>
          {t('goals.create')}
        </button>
      </div>
    </Modal>
  );
}

function GoalRow(props: { g: GoalProgress; onChanged: () => void; onDelete: () => void }) {
  const { t } = useT();
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
          {t('goals.progress', { cat: g.categoryName, done: g.minutesToday, target: g.minutesPerDay })}
          <span style={{ color: met ? 'var(--good)' : 'var(--critical)', fontWeight: 600 }}>
            {met ? t('goals.onTrack') : g.comparator === 'at_most' ? t('goals.overLimit') : t('goals.behind')}
          </span>
        </div>
        <div className="usage-bar" style={{ maxWidth: 'none', marginTop: 6 }}>
          <div style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      <button className="btn danger" onClick={props.onDelete}>
        {t('common.delete')}
      </button>
    </div>
  );
}

export function Goals() {
  const { t } = useT();
  const [bump, setBump] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<GoalProgress | null>(null);
  const goals = usePolled(() => invoke('goals:list'), [bump], 30000);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('goals.title')}</h1>
          <div className="page-sub">{t('goals.sub')}</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          {t('goals.new')}
        </button>
      </div>
      <Card>
        {(goals ?? []).length === 0 ? (
          <div className="empty">
            {t('goals.empty')}
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
          title={t('goals.deleteTitle', { name: deleting.name })}
          message={t('goals.deleteMsg')}
          confirmLabel={t('goals.deleteConfirm')}
          danger
          onConfirm={() => void invoke('goals:delete', { id: deleting.id }).then(() => setBump((b) => b + 1))}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
