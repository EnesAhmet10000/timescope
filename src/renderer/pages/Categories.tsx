import { useState } from 'react';
import { invoke } from '../api';
import { Card, ConfirmModal, Modal, Segmented, usePolled } from '../components/common';
import { useT } from '../i18n';
import type { Category, CategoryKind } from '../../shared/types';

const KIND_TKEY: Record<CategoryKind, string> = {
  productive: 'cat.productive',
  neutral: 'cat.neutral',
  distracting: 'cat.distracting',
};

const PRESET_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];

function CategoryEditor(props: { initial?: Category; onSave: () => void; onClose: () => void }) {
  const { t } = useT();
  const kindOptions = (['productive', 'neutral', 'distracting'] as CategoryKind[]).map((v) => ({ value: v, label: t(KIND_TKEY[v]) }));
  const [name, setName] = useState(props.initial?.name ?? '');
  const [kindV, setKindV] = useState<CategoryKind>(props.initial?.kind ?? 'neutral');
  const [colorV, setColorV] = useState(props.initial?.color ?? PRESET_COLORS[0]!);
  const [error, setError] = useState('');

  const save = async (): Promise<void> => {
    try {
      if (props.initial) {
        await invoke('categories:update', { id: props.initial.id, name, kind: kindV, color: colorV });
      } else {
        await invoke('categories:create', { name, kind: kindV, color: colorV });
      }
      props.onSave();
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cat.saveError'));
    }
  };

  return (
    <Modal title={props.initial ? t('cat.editTitle') : t('cat.newTitle')} onClose={props.onClose}>
      {error ? <div className="error-banner">{error}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <label>
          <div className="setting-label" style={{ marginBottom: 4 }}>{t('cat.name')}</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div>
          <div className="setting-label" style={{ marginBottom: 6 }}>{t('cat.type')}</div>
          <Segmented options={kindOptions} value={kindV} onChange={setKindV} />
        </div>
        <div>
          <div className="setting-label" style={{ marginBottom: 6 }}>{t('cat.color')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`color ${c}`}
                onClick={() => setColorV(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: c,
                  border: colorV === c ? '2px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={name.trim().length === 0} onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </Modal>
  );
}

export function Categories() {
  const { t } = useT();
  const [bump, setBump] = useState(0);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const categories = usePolled(() => invoke('categories:list'), [bump]);

  const kindLabel: Record<CategoryKind, string> = {
    productive: t('cat.productive'),
    neutral: t('cat.neutral'),
    distracting: t('cat.distracting'),
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cat.title')}</h1>
          <div className="page-sub">{t('cat.sub')}</div>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          {t('cat.new')}
        </button>
      </div>
      <Card>
        {(categories ?? []).map((c) => (
          <div className="row" key={c.id}>
            <span className="cat-chip">
              <span className="swatch" style={{ background: c.color }} />
              {c.name}
            </span>
            <span className="row-sub">{kindLabel[c.kind]}{c.isBuiltin ? ` · ${t('cat.builtin')}` : ''}</span>
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setEditing(c)}>{t('common.edit')}</button>
              <button className="btn danger" onClick={() => setDeleting(c)}>{t('common.delete')}</button>
            </span>
          </div>
        ))}
      </Card>
      {editing ? (
        <CategoryEditor
          initial={editing === 'new' ? undefined : editing}
          onSave={() => setBump((b) => b + 1)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title={t('cat.deleteTitle', { name: deleting.name })}
          message={t('cat.deleteMsg')}
          confirmLabel={t('cat.deleteConfirm')}
          danger
          onConfirm={() => {
            void invoke('categories:delete', { id: deleting.id }).then(() => setBump((b) => b + 1));
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
