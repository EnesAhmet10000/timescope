const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.local.get({ enabled: true, port: 48733, token: '', excluded: [] });
  $('enabled').checked = cfg.enabled;
  $('port').value = cfg.port;
  $('token').value = cfg.token;
  $('excluded').value = cfg.excluded.join('\n');
}

async function save() {
  const excluded = $('excluded')
    .value.split('\n')
    .map((s) => s.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean);
  const cfg = {
    enabled: $('enabled').checked,
    port: Math.min(65535, Math.max(1024, Number($('port').value) || 48733)),
    token: $('token').value.trim(),
    excluded,
  };
  await chrome.storage.local.set(cfg);

  const status = $('status');
  status.textContent = 'Saved. Testing connection…';
  status.className = '';
  try {
    const res = await fetch(`http://127.0.0.1:${cfg.port}/api/ping`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    const body = await res.json();
    if (body.ok && body.authorized) {
      status.textContent = '✓ Connected to TimeScope';
      status.className = 'ok';
    } else if (body.ok) {
      status.textContent = 'Reached TimeScope, but the token is wrong. Copy it from Settings.';
      status.className = 'err';
    } else {
      throw new Error('unexpected reply');
    }
  } catch {
    status.textContent =
      'Could not reach TimeScope. Is the app running with “Track websites” enabled in Settings?';
    status.className = 'err';
  }
}

$('save').addEventListener('click', () => void save());
void load();
