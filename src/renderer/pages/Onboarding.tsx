import { useState } from 'react';
import { invoke } from '../api';
import { Switch } from '../components/common';

export function Onboarding(props: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [titles, setTitles] = useState(false);
  const [websites, setWebsites] = useState(false);

  const finish = async (): Promise<void> => {
    await invoke('onboarding:complete', { trackWindowTitles: titles, trackWebsites: websites });
    props.onDone();
  };

  const steps = [
    <div key="0">
      <h2>Welcome to TimeScope</h2>
      <p style={{ color: 'var(--ink-2)' }}>
        TimeScope automatically tracks which applications you use so you can understand where your time goes. It is
        built privacy-first:
      </p>
      <ul className="check-list">
        <li>
          <span className="ok">✓</span> Tracks: active app name, process name, start/end times, idle time
        </li>
        <li>
          <span className="no">✗</span> Never: keystrokes, passwords, clipboard, screenshots, messages, form or page
          contents
        </li>
        <li>
          <span className="ok">✓</span> Everything is stored in a local SQLite database on this computer
        </li>
        <li>
          <span className="ok">✓</span> No account, no cloud, no telemetry — data leaves only if you export it
        </li>
      </ul>
    </div>,
    <div key="1">
      <h2>Optional tracking</h2>
      <p style={{ color: 'var(--ink-2)' }}>These are off unless you turn them on. You can change them anytime in Settings.</p>
      <div className="setting-row">
        <div>
          <div className="setting-label">Window titles</div>
          <div className="setting-desc">
            More detail (e.g. which document or repo), but titles can contain private text. Off = only app names.
          </div>
        </div>
        <Switch checked={titles} onChange={setTitles} />
      </div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Website tracking</div>
          <div className="setting-desc">
            Needs the TimeScope browser extension. Only domains (youtube.com, github.com) and timestamps — never URLs,
            page text, or form data. You can exclude private sites.
          </div>
        </div>
        <Switch checked={websites} onChange={setWebsites} />
      </div>
    </div>,
    <div key="2">
      <h2>You're in control</h2>
      <ul className="check-list">
        <li>
          <span className="ok">✓</span> Pause or resume tracking anytime from the tray icon or Settings
        </li>
        <li>
          <span className="ok">✓</span> Exclude specific apps and websites from ever being recorded
        </li>
        <li>
          <span className="ok">✓</span> Export your data as CSV/JSON, or delete any of it, whenever you want
        </li>
        <li>
          <span className="ok">✓</span> TimeScope keeps tracking quietly from the system tray when you close this
          window
        </li>
      </ul>
    </div>,
  ];

  return (
    <div className="onboard">
      <div className="card">
        <div className="step-dots">
          {steps.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        {steps[step]}
        <div className="modal-actions">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
          {step < steps.length - 1 ? (
            <button className="btn primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button className="btn primary" onClick={() => void finish()}>
              Start tracking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
