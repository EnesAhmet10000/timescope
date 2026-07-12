import { useState } from 'react';
import { invoke } from '../api';
import { Switch, Segmented } from '../components/common';
import { useT, LANGUAGES } from '../i18n';
import type { Language } from '../../shared/types';

export function Onboarding(props: { lang: Language; onChangeLang: (l: Language) => void; onDone: () => void }) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [titles, setTitles] = useState(false);
  const [websites, setWebsites] = useState(false);

  const finish = async (): Promise<void> => {
    await invoke('onboarding:complete', { trackWindowTitles: titles, trackWebsites: websites });
    props.onDone();
  };

  const steps = [
    <div key="0">
      <h2>{t('onb.welcome')}</h2>
      <p style={{ color: 'var(--ink-2)' }}>{t('onb.welcomeIntro')}</p>
      <ul className="check-list">
        <li>
          <span className="ok">✓</span> {t('onb.tracks')}
        </li>
        <li>
          <span className="no">✗</span> {t('onb.never')}
        </li>
        <li>
          <span className="ok">✓</span> {t('onb.local')}
        </li>
        <li>
          <span className="ok">✓</span> {t('onb.noCloud')}
        </li>
      </ul>
    </div>,
    <div key="1">
      <h2>{t('onb.optional')}</h2>
      <p style={{ color: 'var(--ink-2)' }}>{t('onb.optionalIntro')}</p>
      <div className="setting-row">
        <div>
          <div className="setting-label">{t('onb.windowTitles')}</div>
          <div className="setting-desc">{t('onb.windowTitlesDesc')}</div>
        </div>
        <Switch checked={titles} onChange={setTitles} />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">{t('onb.websiteTracking')}</div>
          <div className="setting-desc">{t('onb.websiteTrackingDesc')}</div>
        </div>
        <Switch checked={websites} onChange={setWebsites} />
      </div>
    </div>,
    <div key="2">
      <h2>{t('onb.control')}</h2>
      <ul className="check-list">
        <li>
          <span className="ok">✓</span> {t('onb.controlPause')}
        </li>
        <li>
          <span className="ok">✓</span> {t('onb.controlExclude')}
        </li>
        <li>
          <span className="ok">✓</span> {t('onb.controlExport')}
        </li>
        <li>
          <span className="ok">✓</span> {t('onb.controlTray')}
        </li>
      </ul>
    </div>,
  ];

  return (
    <div className="onboard">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Segmented<Language>
            options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            value={props.lang}
            onChange={props.onChangeLang}
          />
        </div>
        <div className="step-dots">
          {steps.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {steps[step]}
        <div className="modal-actions">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)}>
              {t('onb.back')}
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button className="btn primary" onClick={() => setStep((s) => s + 1)}>
              {t('onb.continue')}
            </button>
          ) : (
            <button className="btn primary" onClick={() => void finish()}>
              {t('onb.startTracking')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
