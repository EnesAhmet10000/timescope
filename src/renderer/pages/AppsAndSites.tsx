/** Applications and Websites pages: usage + per-item category assignment. */
import { useState } from 'react';
import { invoke, fmtDuration, getRange, type View } from '../api';
import { Card, RangePicker, usePolled } from '../components/common';
import { useT } from '../i18n';
import type { Category, Range } from '../../shared/types';

function CategorySelect(props: {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
}) {
  const { t } = useT();
  return (
    <select
      value={props.value ?? ''}
      onChange={(e) => props.onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">{t('common.uncategorized')}</option>
      {props.categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

export function Applications(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { t } = useT();
  const [bump, setBump] = useState(0);
  const { range, view } = props;
  const usage = usePolled(() => invoke('analytics:apps', range), [range.from, range.to, bump]);
  const categories = usePolled(() => invoke('categories:list'), [bump]);

  const assign = async (targetId: number, categoryId: number | null): Promise<void> => {
    await invoke('categories:assign', { targetType: 'app', targetId, categoryId });
    setBump((b) => b + 1);
  };

  const top = usage?.[0]?.ms ?? 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('apps.title')}</h1>
          <div className="page-sub">{t('apps.sub')}</div>
        </div>
        <RangePicker view={view} range={range} onChange={props.onRange} />
      </div>
      <Card>
        {(usage ?? []).length === 0 ? (
          <div className="empty">{t('apps.empty')}</div>
        ) : (
          (usage ?? []).map((a) => (
            <div className="row" key={a.appId}>
              <div className="row-name">
                {a.displayName}
                <span className="row-sub"> · {a.exeName}.exe</span>
              </div>
              <div className="usage-bar">
                <div style={{ width: `${(a.ms / top) * 100}%`, background: a.color ?? 'var(--series-active)' }} />
              </div>
              <span className="row-value" style={{ minWidth: 64, textAlign: 'right' }}>
                {fmtDuration(a.ms)}
              </span>
              <CategorySelect categories={categories ?? []} value={a.categoryId} onChange={(c) => void assign(a.appId, c)} />
            </div>
          ))
        )}
      </Card>
    </>
  );
}

export function Websites(props: { view: View; range: Range; onRange: (v: View, r: Range) => void }) {
  const { t } = useT();
  const [bump, setBump] = useState(0);
  const { range, view } = props;
  const usage = usePolled(() => invoke('analytics:domains', range), [range.from, range.to, bump]);
  const categories = usePolled(() => invoke('categories:list'), [bump]);
  const settings = usePolled(() => invoke('settings:get'), []);

  const assign = async (targetId: number, categoryId: number | null): Promise<void> => {
    await invoke('categories:assign', { targetType: 'domain', targetId, categoryId });
    setBump((b) => b + 1);
  };

  const top = usage?.[0]?.ms ?? 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('sites.title')}</h1>
          <div className="page-sub">{t('sites.sub')}</div>
        </div>
        <RangePicker view={view} range={range} onChange={props.onRange} />
      </div>
      {settings && !settings.trackWebsites ? (
        <div className="error-banner" style={{ color: 'var(--ink-2)', background: 'var(--surface-2)' }}>
          {t('sites.off')}
        </div>
      ) : null}
      <Card>
        {(usage ?? []).length === 0 ? (
          <div className="empty">{t('sites.empty')}</div>
        ) : (
          (usage ?? []).map((d) => (
            <div className="row" key={d.domainId}>
              <div className="row-name">{d.domain}</div>
              <div className="usage-bar">
                <div style={{ width: `${(d.ms / top) * 100}%`, background: d.color ?? 'var(--series-active)' }} />
              </div>
              <span className="row-value" style={{ minWidth: 64, textAlign: 'right' }}>
                {fmtDuration(d.ms)}
              </span>
              <CategorySelect
                categories={categories ?? []}
                value={d.categoryId}
                onChange={(c) => void assign(d.domainId, c)}
              />
            </div>
          ))
        )}
      </Card>
    </>
  );
}

export function defaultRange(view: View): Range {
  return getRange(view);
}
