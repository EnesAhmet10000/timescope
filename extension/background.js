/**
 * TimeScope Companion — MV3 service worker.
 *
 * Privacy: reads ONLY the active tab's domain (never the full URL, title, or
 * page content) and forwards { domain, startTs, endTs } beats to the local
 * TimeScope app at 127.0.0.1. Nothing is sent anywhere else. Excluded domains
 * are dropped at the source and never leave the browser.
 */

const FLUSH_ALARM = 'timescope-flush';
const FLUSH_PERIOD_MIN = 0.5; // 30s batches
const MAX_BUFFER = 500;

const DEFAULTS = {
  enabled: true,
  port: 48733,
  token: '',
  excluded: [], // lowercase domains
};

let current = null; // { domain, startTs }
let buffer = []; // finished beats waiting to be flushed

async function getConfig() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function domainOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isExcluded(domain, excluded) {
  return excluded.some((d) => domain === d || domain.endsWith('.' + d));
}

function endCurrent(now) {
  if (!current) return;
  const beat = { domain: current.domain, startTs: current.startTs, endTs: now };
  current = null;
  if (beat.endTs - beat.startTs >= 1000) {
    buffer.push(beat);
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    void chrome.storage.session?.set({ buffer }).catch(() => {});
  }
}

async function setActiveDomain(domain) {
  const now = Date.now();
  const cfg = await getConfig();
  if (current?.domain === domain) return;
  endCurrent(now);
  if (!cfg.enabled || !domain || isExcluded(domain, cfg.excluded)) return;
  current = { domain, startTs: now };
}

async function refreshFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await setActiveDomain(tab?.url ? domainOf(tab.url) : null);
  } catch {
    await setActiveDomain(null);
  }
}

async function flush() {
  const now = Date.now();
  // Roll the open beat so long stays on one site are reported incrementally.
  if (current) {
    endCurrent(now);
    const cfg = await getConfig();
    if (cfg.enabled) await refreshFromActiveTab();
  }
  if (buffer.length === 0) return;
  const cfg = await getConfig();
  if (!cfg.enabled || !cfg.token) return;
  const batch = buffer.splice(0, 200);
  try {
    const res = await fetch(`http://127.0.0.1:${cfg.port}/api/web-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(String(res.status));
    await chrome.storage.local.set({ lastSync: Date.now(), lastError: '' });
  } catch (err) {
    // App likely closed — keep the batch for later.
    buffer = batch.concat(buffer).slice(-MAX_BUFFER);
    await chrome.storage.local.set({ lastError: `Cannot reach TimeScope (${err.message})` });
  }
  void chrome.storage.session?.set({ buffer }).catch(() => {});
}

// --- event wiring ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
});
chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === FLUSH_ALARM) void flush();
});

chrome.tabs.onActivated.addListener(() => void refreshFromActiveTab());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.url) void refreshFromActiveTab();
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) void setActiveDomain(null);
  else void refreshFromActiveTab();
});
chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') void refreshFromActiveTab();
  else void setActiveDomain(null);
});

// Restore buffered beats after a service-worker restart.
chrome.storage.session?.get({ buffer: [] }).then((v) => {
  if (Array.isArray(v.buffer)) buffer = v.buffer.concat(buffer);
});
void refreshFromActiveTab();
