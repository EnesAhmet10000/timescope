# TimeScope

**Privacy-first automatic time tracking for Windows 10/11.** TimeScope quietly records which
applications you use (and, optionally, which website *domains* you visit), then shows where your
time went in a clean local dashboard — categories, goals, focus sessions, hourly timelines.

Everything stays in a **local SQLite database on your computer**. No account. No cloud. No telemetry.

> "TimeScope" is a temporary working name. All branding lives in `productName` (package.json /
> electron-builder.yml), the `brand` block in `src/renderer/App.tsx`, and the extension manifest —
> renaming the product touches only those spots.

---

## What it records — and what it never records

| Recorded (minimum metadata) | Never recorded |
|---|---|
| Active application name + process name | Keystrokes |
| Executable path (for identification) | Passwords |
| Start time, end time, duration | Clipboard contents |
| Idle periods (idle / locked / suspend) | Screenshots |
| Window title — **only if you opt in** | Message or form contents |
| Website **domain** only — **only if you opt in**, via the extension | Full URLs, page text, browsing content |

Additional controls: pause tracking (tray or Settings), exclude specific apps/domains, retention
auto-cleanup, CSV/JSON export, and granular deletion (date range / browsing only / apps only / all).

## Requirements

- Windows 10 or 11
- Node.js 20+ (developed on Node 24) and npm

No Visual Studio, no Rust, no compilers: the two native-adjacent dependencies are
[koffi](https://koffi.dev) (prebuilt FFI) and node-sqlite3-wasm (WASM SQLite), so `npm install`
is all you need.

## Run it locally

```bash
git clone <this repo>
cd timescope
npm install
npm run dev        # dev mode: Vite + esbuild watch + Electron with hot reload
```

Production-style run:

```bash
npm run build      # typecheck + bundle main/preload + build renderer + generate icons
npx electron .     # run the built app
```

Build a Windows installer:

```bash
npm run dist       # NSIS installer in release/
```

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | Development mode with live reload |
| `npm run build` | Full production build into `dist/` |
| `npm run typecheck` | TypeScript strict-mode check |
| `npm test` | Vitest unit + integration tests (analytics, tracker state machine, DB) |
| `npm run smoke` | Automated end-to-end check: launches the built app hidden against a throwaway DB, tracks for 8 s, asserts sessions were recorded |
| `npm run dist` | Windows installer via electron-builder |
| `npm run icons` | Regenerate tray/app icons (pure-code PNG generation) |

UI-only preview in a normal browser (fabricated data, dev-only):
`npx vite --config vite.config.ts` then open `http://localhost:5183/?mock=1`.

## First run

An onboarding wizard explains what is and is not tracked, where data is stored, and asks for
explicit consent before enabling the two optional trackers (window titles, websites). Both default
to **off**. The app then lives in the system tray: closing the window keeps tracking; *Quit* is in
the tray menu. Enable **Start with Windows** in Settings to survive reboots (applies to the
installed build).

## Browser extension (optional website tracking)

The extension sends **only** `{ domain, startTs, endTs }` — e.g. `youtube.com`, `github.com` — to
your local app over `127.0.0.1`. Never page text, titles, full URLs, forms, or history. Excluded
domains are dropped inside the browser and never leave it.

Setup:

1. In TimeScope → **Settings**, enable **Track websites**. Note the port + token shown there.
2. In Chrome/Edge/Brave: `chrome://extensions` → enable *Developer mode* → *Load unpacked* →
   select the `extension/` folder.
3. Open the extension's **Options**, paste the port + token, add any private domains to exclude,
   and press **Save & test connection** — it should report "Connected to TimeScope".

The local endpoint only listens while website tracking is enabled, binds to `127.0.0.1` only, and
requires the bearer token (constant-time compared). Turning **Track websites** off shuts the
listener down entirely.

## Architecture

**Electron + React + TypeScript (strict) + SQLite.** Tauri was the preferred stack, but it
hard-requires a Rust toolchain plus MSVC build tools; this codebase was built to compile with
nothing but Node. To keep a future Tauri port cheap, the core logic (tracker state machine,
analytics, schema) is dependency-injected plain TypeScript with no Electron imports.

```
src/
  shared/types.ts        Single source of truth for cross-process types (IPC schema)
  main/                  Electron main process
    index.ts             Wiring: app lifecycle, window, powerMonitor, retention job
    win32.ts             Foreground window via user32/kernel32 (koffi FFI)
    tracker.ts           Activity engine: polling, session grouping, idle state machine
    db.ts                SQLite driver wrapper + migrations
    catalog.ts           Apps/domains registry, category seeding & auto-categorization
    analytics.ts         Interval clipping, bucketing, summaries (pure functions + queries)
    focus.ts             Focus sessions with distraction warnings
    ipc.ts               Validated IPC command surface (renderer = untrusted input)
    webserver.ts         Localhost-only endpoint for the browser extension
    exporter.ts          CSV/JSON export, deletion, retention
    settings.ts          Typed, sanitized settings store
    tray.ts              Tray icon + menu (state-aware)
  preload/index.ts       Channel-allowlisted contextBridge (no Node in renderer)
  renderer/              React dashboard (Vite): pages, charts, design system
extension/               Chrome MV3 companion (domain + timestamps only)
tests/                   Vitest: analytics math, tracker state machine, DB integration
scripts/                 dev runner, esbuild bundling, smoke test, icon generation
```

### How tracking works

- A 2-second poll reads the foreground window (`GetForegroundWindow` →
  `QueryFullProcessImageNameW`) and system idle time (`powerMonitor.getSystemIdleTime`).
- Continuous focus on one app is **one** `sessions` row; its `end_ts` is updated in place each
  poll, so a crash/power-loss costs at most ~2 s and never leaves dangling rows. Quick alt-tabs
  away and back (≤ 5 s) merge into the previous row instead of spawning duplicates; sub-second
  slivers are dropped.
- Idle detection is **retroactive**: when the threshold (default 5 min, configurable) is crossed,
  the session is truncated back to when input actually stopped and an idle period starts there.
- Lock screen, sleep, and shutdown are handled via `powerMonitor` events (`locked` / `suspend`
  idle kinds); tracking resumes automatically on unlock/resume.

### Database schema (SQLite, versioned migrations)

```
apps(id, exe_name UNIQUE, display_name, exe_path, first_seen, last_seen)
domains(id, domain UNIQUE, first_seen, last_seen)
categories(id, name UNIQUE, kind[productive|neutral|distracting], color, is_builtin)
category_assignments(id, target_type[app|domain], target_id, category_id, UNIQUE(target_type,target_id))
sessions(id, app_id→apps, title NULL, start_ts, end_ts)         + idx(start_ts), idx(app_id)
web_sessions(id, domain_id→domains, start_ts, end_ts)           + idx(start_ts)
idle_periods(id, kind[idle|locked|suspend], start_ts, end_ts)   + idx(start_ts)
goals(id, name, category_id→categories, comparator[at_most|at_least], minutes_per_day, active)
focus_sessions(id, start_ts, end_ts NULL, planned_minutes, blocked_category_ids JSON,
               distraction_seconds, warnings)
settings(key PK, value JSON)
schema_migrations(version PK, applied_at)
```

All timestamps are Unix epoch milliseconds. Database file: `%APPDATA%/timescope/timescope.db`
(shown in Settings).

## Privacy model

1. **Local-only by default.** There is no cloud component, no account, no telemetry, and no
   analytics SDK. Data leaves the machine only when the user explicitly exports a file. Any future
   cloud-sync feature must live in a separate, clearly opt-in module — nothing in the current
   codebase phones home.
2. **Data minimization.** Only the metadata in the table above is collected. Window titles and
   website domains are opt-in with explicit onboarding consent, and each can be disabled at any
   time. Excluded apps/domains are never written to the database (dropped at the source).
3. **Untrusted boundaries.** Every IPC command validates its payload; the preload exposes a fixed
   channel allowlist with `contextIsolation` + `sandbox` and no Node integration. The extension
   endpoint binds to loopback only, requires a token, accepts only well-formed
   domain-plus-timestamp beats, and rejects oversized bodies.
4. **User control.** Pause anytime, retention auto-delete, full or partial deletion with explicit
   confirmation, CSV/JSON export.

## Tests

`npm test` covers the pure analytics math (clipping, bucketing, summaries), the tracker state
machine (grouping, merging, retroactive idle, lock screen, pause, exclusions, title opt-in), and
DB integration (migrations, cascade deletes, retention, export escaping, input sanitization) — 30
tests. `npm run smoke` exercises the real app end-to-end.
