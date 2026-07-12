import { useState } from 'react';
import { invoke, fromDateInputValue, toDateInputValue } from '../api';
import { Card, ConfirmModal, Modal, Segmented, Switch, usePolled } from '../components/common';
import type { DeleteMode, Settings as SettingsT, Theme } from '../../shared/types';

function RangeDeleteModal(props: { onDeleted: (n: number) => void; onClose: () => void }) {
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
    <Modal title="Delete a date range" onClose={props.onClose}>
      <p style={{ color: 'var(--ink-2)' }}>
        Permanently removes all app, website and idle records whose start falls in this range.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: 'var(--muted)' }}>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>Cancel</button>
        <button className="btn danger" onClick={() => setConfirming(true)}>Delete range…</button>
      </div>
      {confirming ? (
        <ConfirmModal
          title="Delete this date range?"
          message={`All activity from ${from} through ${to} will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete permanently"
          danger
          onConfirm={() => void doDelete()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </Modal>
  );
}

function TagListEditor(props: { items: string[]; placeholder: string; onChange: (items: string[]) => void }) {
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
        {props.items.length === 0 ? <span className="row-sub">None</span> : null}
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
          Add
        </button>
      </div>
    </div>
  );
}

export function SettingsPage(props: { onSettingsChanged: () => void }) {
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
    setNotice(res.savedTo ? `Exported to ${res.savedTo}` : '');
  };

  const openDataFolder = async (): Promise<void> => {
    const res = await invoke('system:openDataDir');
    if (!res.opened) setNotice('Could not open the data folder.');
  };

  const restartApp = (): void => {
    void invoke('system:restart');
  };

  const doDelete = async (mode: DeleteMode): Promise<void> => {
    const res = await invoke('data:delete', mode === 'range' ? { mode, from: 0, to: Date.now() } : { mode });
    setNotice(`Deleted ${res.deletedRows} records.`);
    props.onSettingsChanged();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">
            Data folder: <code className="inline">{info?.dataDir ?? '…'}</code>
          </div>
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void openDataFolder()}>
            Open data folder
          </button>
          <button className="btn" onClick={restartApp}>
            Restart app
          </button>
        </span>
      </div>

      {notice ? (
        <div className="error-banner" style={{ color: 'var(--good)', background: 'var(--surface-2)' }}>
          {notice}
        </div>
      ) : null}

      <Card title="Tracking">
        <div className="setting-row">
          <div>
            <div className="setting-label">Pause tracking</div>
            <div className="setting-desc">Nothing is recorded while paused. Also available from the tray icon.</div>
          </div>
          <Switch checked={settings.trackingPaused} onChange={(v) => void update({ trackingPaused: v })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Track window titles</div>
            <div className="setting-desc">
              Off by default. Titles can contain document names or message subjects; leave off for stricter privacy.
            </div>
          </div>
          <Switch checked={settings.trackWindowTitles} onChange={(v) => void update({ trackWindowTitles: v })} />
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Track websites</div>
            <div className="setting-desc">
              Requires the TimeScope browser extension. Only the domain (e.g. github.com) and timestamps are received —
              never URLs or page content.
            </div>
          </div>
          <Switch checked={settings.trackWebsites} onChange={(v) => void update({ trackWebsites: v })} />
        </div>
        {settings.trackWebsites ? (
          <div className="setting-row">
            <div>
              <div className="setting-label">Extension connection</div>
              <div className="setting-desc">
                In the extension options set port <code className="inline">{settings.extensionPort}</code> and token{' '}
                <code className="inline">{settings.extensionToken}</code>
              </div>
            </div>
          </div>
        ) : null}
        <div className="setting-row">
          <div>
            <div className="setting-label">Idle timeout</div>
            <div className="setting-desc">After this long without input, time is counted as idle instead of active.</div>
          </div>
          <select
            value={settings.idleThresholdSec}
            onChange={(e) => void update({ idleThresholdSec: Number(e.target.value) })}
          >
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={300}>5 minutes (default)</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Start with Windows</div>
            <div className="setting-desc">Launch TimeScope minimized to the tray when you sign in. (Applies to the installed app.)</div>
          </div>
          <Switch checked={settings.startWithWindows} onChange={(v) => void update({ startWithWindows: v })} />
        </div>
      </Card>

      <h4 className="section">Appearance</h4>
      <Card>
        <div className="setting-row">
          <div className="setting-label">Theme</div>
          <Segmented<Theme>
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={settings.theme}
            onChange={(v) => void update({ theme: v })}
          />
        </div>
      </Card>

      <h4 className="section">Exclusions</h4>
      <Card>
        <div className="setting-row">
          <div>
            <div className="setting-label">Excluded applications</div>
            <div className="setting-desc">Process names that are never recorded (e.g. keepass, 1password).</div>
            <TagListEditor
              items={settings.excludedApps}
              placeholder="process name, e.g. keepass"
              onChange={(items) => void update({ excludedApps: items })}
            />
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Excluded websites</div>
            <div className="setting-desc">Domains that are never recorded, including subdomains (e.g. mybank.com).</div>
            <TagListEditor
              items={settings.excludedDomains}
              placeholder="domain, e.g. mybank.com"
              onChange={(items) => void update({ excludedDomains: items })}
            />
          </div>
        </div>
      </Card>

      <h4 className="section">Data</h4>
      <Card>
        <div className="setting-row">
          <div>
            <div className="setting-label">Data retention</div>
            <div className="setting-desc">Automatically delete activity older than this.</div>
          </div>
          <select
            value={settings.retentionDays}
            onChange={(e) => void update({ retentionDays: Number(e.target.value) })}
          >
            <option value={0}>Keep forever</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Export data</div>
            <div className="setting-desc">Save all local activity to a file of your choosing.</div>
          </div>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => void doExport('csv')}>
              Export CSV
            </button>
            <button className="btn" onClick={() => void doExport('json')}>
              Export JSON
            </button>
          </span>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Delete data</div>
            <div className="setting-desc">Permanently remove recorded activity from this computer.</div>
          </div>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn danger" onClick={() => setRangeDelete(true)}>
              Date range…
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'web', label: 'all browsing data' })}>
              Browsing data
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'apps', label: 'all application data' })}>
              App data
            </button>
            <button className="btn danger" onClick={() => setConfirm({ mode: 'all', label: 'ALL local data' })}>
              Everything
            </button>
          </span>
        </div>
      </Card>

      <div className="row-sub" style={{ marginTop: 18 }}>
        TimeScope v{info?.version ?? '…'} · local-only build — no cloud sync, no telemetry.
      </div>

      {confirm ? (
        <ConfirmModal
          title="Delete data?"
          message={`This permanently deletes ${confirm.label} from this computer. This cannot be undone.`}
          confirmLabel="Delete permanently"
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
