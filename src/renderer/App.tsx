import { useCallback, useEffect, useState } from 'react';
import { invoke, getRange, onStateChanged, type View } from './api';
import { usePolled } from './components/common';
import { Overview } from './pages/Overview';
import { Timeline } from './pages/Timeline';
import { Applications, Websites } from './pages/AppsAndSites';
import { Categories } from './pages/Categories';
import { Goals } from './pages/Goals';
import { Focus } from './pages/Focus';
import { SettingsPage } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import type { Range, Settings, Theme } from '../shared/types';

type Page = 'overview' | 'timeline' | 'applications' | 'websites' | 'categories' | 'goals' | 'focus' | 'settings';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'M3 13h6v8H3zM10 3h6v18h-6zM17 8h4v13h-4z' },
  { id: 'timeline', label: 'Timeline', icon: 'M12 8v5l3 2M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z' },
  { id: 'applications', label: 'Applications', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { id: 'websites', label: 'Websites', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 4 6.5 4 10s-1 7-4 10c-3-3-4-6.5-4-10s1-7 4-10z' },
  { id: 'categories', label: 'Categories', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'goals', label: 'Goals', icon: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zM12 13.5a1.5 1.5 0 1 1 0-3' },
  { id: 'focus', label: 'Focus', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z' },
  { id: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z' },
];

function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export default function App() {
  const [page, setPage] = useState<Page>('overview');
  const [view, setView] = useState<View>('today');
  const [range, setRange] = useState<Range>(() => getRange('today'));
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsBump, setSettingsBump] = useState(0);

  const loadSettings = useCallback(() => {
    void invoke('settings:get').then((s) => {
      setSettings(s);
      applyTheme(s.theme);
    });
  }, []);

  useEffect(() => {
    loadSettings();
    const off = onStateChanged(loadSettings);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMq = (): void => loadSettings();
    mq.addEventListener('change', onMq);
    return () => {
      off();
      mq.removeEventListener('change', onMq);
    };
  }, [loadSettings, settingsBump]);

  const status = usePolled(() => invoke('tracking:status'), [settingsBump], 5000);

  // Refresh non-custom ranges when the day/time advances.
  const onRange = (v: View, r: Range): void => {
    setView(v);
    setRange(r);
  };
  useEffect(() => {
    const t = setInterval(() => {
      if (view !== 'custom') setRange(getRange(view));
    }, 60_000);
    return () => clearInterval(t);
  }, [view]);

  if (!settings) return null;
  if (!settings.onboardingDone) {
    return (
      <Onboarding
        onDone={() => {
          setSettingsBump((b) => b + 1);
        }}
      />
    );
  }

  const rangeProps = { view, range, onRange };

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-dot" />
          TimeScope
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </button>
        ))}
        <div className="sidebar-footer">
          <span className={`tracking-pill ${status?.paused ? 'paused' : ''}`}>
            <span className="dot" />
            {status?.paused ? 'Paused' : status?.state === 'idle' ? 'Idle' : 'Tracking'}
          </span>
        </div>
      </nav>
      <main className="main">
        {page === 'overview' ? <Overview {...rangeProps} /> : null}
        {page === 'timeline' ? <Timeline {...rangeProps} /> : null}
        {page === 'applications' ? <Applications {...rangeProps} /> : null}
        {page === 'websites' ? <Websites {...rangeProps} /> : null}
        {page === 'categories' ? <Categories /> : null}
        {page === 'goals' ? <Goals /> : null}
        {page === 'focus' ? <Focus /> : null}
        {page === 'settings' ? <SettingsPage onSettingsChanged={() => setSettingsBump((b) => b + 1)} /> : null}
      </main>
    </div>
  );
}
