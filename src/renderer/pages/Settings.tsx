import { useEffect, useState } from 'react';
import { invoke, fromDateInputValue, onUpdateEvent, toDateInputValue } from '../api';
import { Card, ConfirmModal, Modal, Segmented, Switch, usePolled } from '../components/common';
import { useT, LANGUAGES } from '../i18n';
import type { DeleteMode, Language, Settings as SettingsT, Theme, UpdateInfo } from '../../shared/types';

function UpdatesCard() {
  const { t } = useT();
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    void invoke('update:state').then(setInfo);
    const off = onUpdateEvent((i) => setInfo(i as UpdateInfo));
    return off;
  }, []);

  const status = info?.status ?? 'idle';
  const busy = status === 'checking' || status === 'downloading';

  const check = (): void => void invoke('update:check').then(setInfo);
  const download = (): void => void invoke('update:download').then(setInfo);
  const install = (): void => void invoke('update:install');

  const statusLine = (): string => {
    switch (status) {
      case 'checking':
        return t('update.checking');
      case 'up-to-date':
        return t('update.upToDate');
      case 'available':
        return t('update.available', { v: info?.latestVersion ?? '' });
      case 'downloading':
        return t('update.downloading', { p: info?.progress ?? 0 });
      case 'downloaded':
        return t('update.downloaded');
      case 'error':
        return t('update.error', { e: info?.error ?? '' });
      default:
        return t('update.current', { v: info?.currentVersion ?? '…' });
    }
  };

  return (
    <Card>
      <div className="setting-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="setting-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
            </svg>
            {t('update.title')}
            <span className="info-badge" role="img" aria-label={t('update.info')} title={t('update.info')}>
              !
            </span>
          </div>
          <div className="setting-desc" style={{ color: status === 'error' ? 'var(--critical)' : undefined }}>
            {statusLine()}
          </div>
          {status !== 'idle' ? <div className="row-sub">{t('update.current', { v: info?.currentVersion ?? '…' })}</div> : null}
          {status === 'downloading' ? (
            <div className="usage-bar" style={{ maxWidth: 'none', marginTop: 8 }}>
              <div style={{ width: `${info?.progress ?? 0}%`, background: 'var(--accent)' }} />
            </div>
          ) : null}
          {info && !info.canInstall ? <div className="row-sub" style={{ marginTop: 4 }}>{t('update.devOnly')}</div> : null}
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {status === 'available' && info?.canInstall ? (
            <button className="btn primary" onClick={download}>
              {t('update.download')}
            </button>
          ) : null}
          {status === 'downloaded' && info?.canInstall ? (
            <button className="btn primary" onClick={install}>
              {t('update.install')}
            </button>
          ) : null}
          <button className="btn" disabled={busy} onClick={check}>
            {status === 'checking' ? t('update.checking') : t('update.check')}
          </button>
        </span>
      </div>
    </Card>
  );
}

function RangeDeleteModal(props: { onDeleted: (n: number) => void; onClose: () => void }) {
  const { t } = useT();
  const DAY = 86_400_000;
  const [from, setFrom] = useState(toDateInputValue(Date.now() - 7 * DAY));
  const [to, setTo] = useState(toDateInputValue(Date.now()));
  const [confirming, setConfirming] = useState(false);

  const doDelete = async (): Promise<void> => {
    const res = await invoke('data:delete', {
      mode: 'range',
      from: fromDateInputValue(from),
      to: fromDateInputValue(to) + DAY, // include the whole end day
    });
    props.onDeleted(res.deletedRows);
    props.onClose();
  };

  return (
    <Modal title={t('settings.rangeDelTitle')} onClose={props.onClose}>
      <p style={{ color: 'var(--ink-2)' }}>
        {t('settings.rangeDelMsg')}
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: 'var(--muted)' }}>{t('range.to')}</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>{t('common.cancel')}</button>
        <button className="btn danger" onClick={() => setConfirming(true)}>{t('settings.rangeDelBtn')}</button>
      </div>
      {confirming ? (
        <ConfirmModal
          title={t('settings.rangeConfirmTitle')}
          message={t('settings.rangeConfirmMsg', { from, to })}
          confirmLabel={t('settings.delConfirm')}
          danger
          onConfirm={() => void doDelete()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Modal>
  );
}

function TagListEditor(props: { items: string[]; placeholder: string; onChange: (items: string[]) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState('');
  const add = (): void => {
    const v = draft.trim().toLowerCase();
    if (v && !props.items.includes(v)) props.onChange([...props.items, v]);
    setDraft('');
  };
  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ marginBottom: 6 }}>
        {props.items.map((it) => (
          <span className="tag" key={it}>
            {it}
            <button aria-label={`remove ${it}`} onClick={() => props.onChange(props.items.filter((x) => x !== it))}>
              ✕
            </button>
          </span>
        ))}
        {props.items.length === 0 ? <span className="row-sub">{t('common.none')}</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={draft}
          placeholder={props.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn" onClick={add}>
          {t('common.add')}
        </button>
      </div>
    </div>
  );
}

export function SettingsPage(props: { onSettingsChanged: () => void }) {
  const { t } = useT();
  const [bump, setBump] = useState(0);
  const [confirm, setConfirm] = useState<{ mode: DeleteMode; label: string } | null>(null);
  const [rangeDelete, setRangeDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const settings = usePolled(() => invoke('settings:get'), [bump], 60000);
  const info = usePolled(() => invoke('system:info'), []);

  if (!settings) return null;

  const update = async (patch: Partial<SettingsT>): Promise<void> => {
    await invoke('settings:update', patch);
    setBump((b) => b + 1);
    props.onSettingsChanged();
  };

  const doExport = async (format: 'csv' | 'json'): Promise<void> => {
    const res = await invoke('data:export', { format, from: 0, to: Date.now() });
    setNotice(res.savedTo ? t('settings.exportedTo', { path: res.savedTo }) : '');
  };

  const openDataFolder = async (): Promise<void> => {
    const res = await invoke('system:openDataDir');
    if (!res.opened) setNotice(t('settings.folderError'));
  };

  const restartApp = (): void => {
    void invoke('system:restart');
  };

  const doDelete = async (mode: DeleteMode): Promise<void> => {
    const res = await invoke('data:delete', mode === 'range' ? { mode, from: 0, to: Date.now() } : { mode });
    setNotice(t('settings.deletedN', { n: res.deletedRows }));
    props.onSettingsChanged();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <div className="page-sub">
            {t('settings.dataFolder')} <code className="inline">{info?.dataDir ?? '…'}</code>
          </div>
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void openDataFolder()}>
            {t('settings.openFolder')}
          </button>
          <button className="btn" onClick={restartApp}>
            {t('settings.restart')}
          </button>
        </span>
      </div>

      {notice ? (
        <div className="error-banner" style={{ color: 'var(--good)', background: 'var(--surface-2)' }}>
          {notice}
        </div>
      ) : null}

      <Card title={t('settings.tracking')}>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.pause')}</div>
            <div className="setting-desc">{t('settings.pauseDesc')}</div>
          </div>
          <Switch checked={settings.trackingPaused} onChange={(v) => void update({ trackingPaused: v })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.titles')}</div>
            <div className="setting-desc">
              {t('settings.titlesDesc')}
            </div>
          </div>
          <Switch checked={settings.trackWindowTitles} onChange={(v) => void update({ trackWindowTitles: v })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.websites')}</div>
            <div className="setting-desc">
              {t('settings.websitesDesc')}
            </div>
          </div>
          <Switch checked={settings.trackWebsites} onChange={(v) => void update({ trackWebsites: v })} />
        </div>
        {settings.trackWebsites ? (
          <div className="setting-row">
            <div>
              <div className="setting-label">{t('settings.extConn')}</div>
              <div className="setting-desc">
                {t('settings.extConnDesc', { port: settings.extensionPort, token: settings.extensionToken })}
              </div>
            </div>
          </div>
        ) : null}
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.idle')}</div>
            <div className="setting-desc">{t('settings.idleDesc')}</div>
          </div>
          <select
            value={settings.idleThresholdSec}
            onChange={(e) => void update({ idleThresholdSec: Number(e.target.value) })}
          >
            <option value={60}>{t('settings.min1')}</option>
            <option value={120}>{t('settings.min2')}</option>
            <option value={300}>{t('settings.min5')}</option>
            <option value={600}>{t('settings.min10')}</option>
            <option value={900}>{t('settings.min15')}</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.startup')}</div>
            <div className="setting-desc">{t('settings.startupDesc')}</div>
          </div>
          <Switch checked={settings.startWithWindows} onChange={(v) => void update({ startWithWindows: v })} />
        </div>
      </Card>

      <h4 className="section">{t('settings.appearance')}</h4>
      <Card>
        <div className="setting-row">
          <div className="setting-label">{t('settings.theme')}</div>
          <Segmented<Theme>
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            value={settings.theme}
            onChange={(v) => void update({ theme: v })}
          />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.language')}</div>
            <div className="setting-desc">{t('settings.languageDesc')}</div>
          </div>
          <Segmented<Language>
            options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            value={settings.language}
            onChange={(v) => void update({ language: v })}
          />
        </div>
      </Card>

      <h4 className="section">{t('settings.exclusions')}</h4>
      <Card>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.exclApps')}</div>
            <div className="setting-desc">{t('settings.exclAppsDesc')}</div>
            <TagListEditor
              items={settings.excludedApps}
              placeholder={t('settings.exclAppsPh')}
              onChange={(items) => void update({ excludedApps: items })}
            />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.exclSites')}</div>
            <div className="setting-desc">{t('settings.exclSitesDesc')}</div>
            <TagListEditor
              items={settings.excludedDomains}
              placeholder={t('settings.exclSitesPh')}
              onChange={(items) => void update({ excludedDomains: items })}
            />
          </div>
        </div>
      </Card>

      <h4 className="section">{t('settings.data')}</h4>
      <Card>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.retention')}</div>
            <div className="setting-desc">{t('settings.retentionDesc')}</div>
          </div>
          <select
            value={settings.retentionDays}
            onChange={(e) => void update({ retentionDays: Number(e.target.value) })}
          >
            <option value={0}>{t('settings.keepForever')}</option>
            <option value={30}>{t('settings.days30')}</option>
            <option value={90}>{t('settings.days90')}</option>
            <option value={180}>{t('settings.days180')}</option>
            <option value={365}>{t('settings.year1')}</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.export')}</div>
            <div className="setting-desc">{t('settings.exportDesc')}</div>
          </div>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => void doExport('csv')}>
              {t('settings.exportCsv')}
            </button>
            <button className="btn" onClick={() => void doExport('json')}>
              {t('settings.exportJson')}
            </button>
          </span>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">{t('settings.deleteData')}</div>
            <div className="setting-desc">{t('settings.deleteDataDesc')}</div>
          </div>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn danger" onClick={() => setRangeDelete(true)}>
              {t('settings.dateRange')}
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'web', label: t('settings.labelWeb') })}>
              {t('settings.browsingData')}
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'apps', label: t('settings.labelApps') })}>
              {t('settings.appData')}
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'all', label: t('settings.labelAll') })}>
              {t('settings.everything')}
            </button>
          </span>
        </div>
      </Card>

      <h4 className="section">{t('update.title')}</h4>
      <UpdatesCard />

      <div className="row-sub" style={{ marginTop: 18 }}>
        {t('settings.footer', { v: info?.version ?? '…' })}
        <br />
        {'© 2026 EnesAhmet10000 · MIT License'}
      </div>

      {confirm ? (
        <ConfirmModal
          title={t('settings.delTitle')}
          message={t('settings.delMsg', { label: confirm.label })}
          confirmLabel={t('settings.delConfirm')}
          danger
          onConfirm={() => void doDelete(confirm.mode)}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {rangeDelete ? (
        <RangeDeleteModal
          onDeleted={(n) => {
            setNotice(`Deleted ${n} records.`);
            props.onSettingsChanged();
          }}
          onClose={() => setRangeDelete(false)}
        />
      ) : null}
    </>
  );
}
