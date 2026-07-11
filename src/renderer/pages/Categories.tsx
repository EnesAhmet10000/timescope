import { useState } from 'react';
import { invoke } from '../api';
import { Card, ConfirmModal, Modal, Segmented, usePolled } from '../components/common';
import type { Category, CategoryKind } from '../../shared/types';

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'productive', label: 'Productive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'distracting', label: 'Distracting' },
];

const PRESET_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];

function CategoryEditor(props: { initial?: Category; onSave: () => void; onClose: () => void }) {
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
      setError(e instanceof Error ? e.message : 'Could not save category');
    }
  };

  return (
    <Modal title={props.initial ? 'Edit category' : 'New category'} onClose={props.onClose}>
      {error ? <div className="error-banner">{error}</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <label>
          <div className="setting-label" style={{ marginBottom: 4 }}>Name</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </label>
        <div>
          <div className="setting-label" style={{ marginBottom: 6 }}>Type</div>
          <Segmented options={KIND_OPTIONS} value={kindV} onChange={setKindV} />
        </div>
        <div>
          <div className="setting-label" style={{ marginBottom: 6 }}>Color</div>
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
        <button className="btn" onClick={props.onClose}>Cancel</button>
        <button className="btn primary" disabled={name.trim().length === 0} onClick={() => void save()}>
          Save
        </button>
      </div>
    </Modal>
  );
}

export function Categories() {
  const [bump, setBump] = useState(0);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const categories = usePolled(() => invoke('categories:list'), [bump]);

  const kindLabel: Record<CategoryKind, string> = {
    productive: 'Productive',
    neutral: 'Neutral',
    distracting: 'Distracting',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Categories</h1>
          <div className="page-sub">Group apps and websites, and mark them productive, neutral, or distracting.</div>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          + New category
        </button>
      </div>
      <Card>
        {(categories ?? []).map((c) => (
          <div className="row" key={c.id}>
            <span className="cat-chip">
              <span className="swatch" style={{ background: c.color }} />
              {c.name}
            </span>
            <span className="row-sub">{kindLabel[c.kind]}{c.isBuiltin ? ' · built-in' : ''}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setEditing(c)}>Edit</button>
              <button className="btn danger" onClick={() => setDeleting(c)}>Delete</button>
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
          title={`Delete "${deleting.name}"?`}
          message="Apps and websites in this category become uncategorized. Recorded time is kept."
          confirmLabel="Delete category"
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
