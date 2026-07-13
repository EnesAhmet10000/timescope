# TimeScope 🕒

**A free, open-source, privacy-first RescueTime alternative for macOS — all your time-tracking data stays 100% local, with no cloud, no account, and no telemetry.**

> **macOS build:** TimeScope runs on Apple silicon Macs (arm64). It tracks the frontmost app locally; window titles remain optional and may require macOS Screen Recording permission.

TimeScope automatically tracks which desktop apps (and, optionally, which website domains) you spend time on, then shows you a clean local dashboard — daily summaries, categories, goals, focus sessions, and hourly timelines. Think *RescueTime, Rize, or ActivityWatch — but everything stays on your own machine.*

🔗 Repository: [github.com/EnesAhmet10000/timescope](https://github.com/EnesAhmet10000/timescope)

**🌐 Language / اللغة / Dil:** [العربية](#-العربية) · [English](#-english) · [Türkçe](#-türkçe)

---

## 🇸🇦 العربية

### 🙂 بالعامية بسيطة

- ⏱️ TimeScope برنامج صغير يشتغل بالخلفية على جهاز الويندوز، ويحسب لك **كم قضيت من وقت بكل برنامج** (كروم، وورد، ألعاب، أي شي تفتحه).
- 📊 يعطيك لوحة تقارير حلوة تبين وين راح وقتك اليوم، أمس، آخر أسبوع، أو أي فترة تختارها.
- 🔒 **ما يرسل ولا بايت وحد عبر الإنترنت.** كل شي يتخزن بملف واحد على جهازك، وخلاص.
- ⌨️ **ما يسجل كيبورد ولا كلمات مرور ولا لقطات شاشة ولا محتوى رسائلك.** يعرف بس "أنت فاتح تطبيق X من الساعة كذا للساعة كذا".
- 🌐 تتبع المواقع اختياري 100%، وحتى لو فعّلته ما يسجل غير اسم الموقع (مثل youtube.com) مو محتواه.
- 🎯 فيه تصنيفات (منتج / محايد / مشتت)، أهداف يومية، ووضع تركيز (فوكس) يذكرك إذا صرت تتشتت.
- 🗑️ تقدر توقف التتبع أو تحذف كل بياناتك بضغطة زر أي وقت تبي.
- 🆓 **مجاني ومفتوح المصدر بالكامل** — الكود كله أمامك تتأكد بنفسك ما فيه شي مخفي.

### 📘 الشرح الكامل

**ما هو TimeScope؟**
TimeScope هو **بديل مجاني ومفتوح المصدر لبرنامج RescueTime**، مبني خصيصاً حول مبدأ "الخصوصية أولاً". يراقب تلقائياً التطبيق النشط على جهازك (اسم البرنامج، وقت البداية والنهاية، ومدة الاستخدام)، ويكتشف أوقات الخمول، ويعرض كل هذا بلوحة تحكم عصرية — بدون أي اتصال بالإنترنت.

**ماذا يسجّل ولا يسجّل؟**

| ✅ يسجّل (الحد الأدنى فقط) | ❌ لا يسجّل أبداً |
|---|---|
| اسم التطبيق النشط واسم العملية | ضغطات الكيبورد |
| مسار الملف التنفيذي (للتعرّف عليه) | كلمات المرور |
| وقت البداية والنهاية والمدة | محتوى الحافظة (نسخ/لصق) |
| فترات الخمول (خامل/مقفل/سبات) | لقطات الشاشة |
| عنوان النافذة — **فقط إذا فعّلته بنفسك** | محتوى الرسائل أو النماذج |
| نطاق الموقع فقط (مثل github.com) — **اختياري عبر إضافة المتصفح** | عناوين URL الكاملة أو نص الصفحات |

**المتطلبات:** ويندوز 10 أو 11، و Node.js 20+ و npm.

**التشغيل محلياً:**
```bash
git clone https://github.com/EnesAhmet10000/timescope.git
cd timescope
npm install
npm run dev
```

بناء نسخة إنتاجية وتثبيت على الجهاز:
```bash
npm run build      # فحص الأنواع + تجميع + توليد الأيقونات
npm run dist        # ينتج ملف تثبيت Windows (NSIS) داخل مجلد release/
```

**أول تشغيل:** يظهر معالج ترحيبي يشرح بوضوح ماذا يُسجَّل وماذا لا يُسجَّل، وأين تُحفظ البيانات، ويطلب موافقتك الصريحة قبل تفعيل أي خاصية اختيارية (عناوين النوافذ أو تتبع المواقع) — وكلاهما مطفأ افتراضياً.

**نموذج الخصوصية باختصار:**
1. **محلي بالكامل افتراضياً** — لا سحابة، لا حساب، لا تيليمتري، لا مكتبات تحليلات مخفية.
2. **أقل بيانات ممكنة** — فقط الجدول أعلاه، والخصائص الحساسة اختيارية بموافقة صريحة.
3. **حدود موثوقة** — كل أمر داخلي يُتحقق منه، والإضافة المتصفحية تتواصل فقط عبر `127.0.0.1` (داخل جهازك) وبرمز أمان (توكن).
4. **تحكم كامل للمستخدم** — إيقاف مؤقت، حذف جزئي أو كلي، تصدير CSV/JSON، تنظيف تلقائي حسب مدة الاحتفاظ التي تحددها.

### ❓ أسئلة شائعة

**هل TimeScope مجاني؟**
نعم، مجاني بالكامل ومفتوح المصدر تحت رخصة MIT، بدون اشتراكات أو نسخة مدفوعة.

**هل يرسل TimeScope بياناتي إلى الإنترنت؟**
لا. لا يوجد أي اتصال خارجي في الكود. البيانات تبقى في قاعدة بيانات SQLite محلية على جهازك فقط.

**هل TimeScope بديل جيد لبرنامج RescueTime؟**
نعم، إذا كنت تبحث عن بديل خصوصية-أولاً لـ RescueTime يعمل بدون اتصال إنترنت وبدون حساب سحابي، على ويندوز.

**هل يدعم ماك أو لينكس؟**
النسخة الحالية مبنية لويندوز 10/11 فقط. الكود الأساسي (التتبع والتحليلات) منفصل عن Electron لتسهيل أي منفذ مستقبلي.

---

## 🇬🇧 English

### 🙂 The Simple Version

- ⏱️ TimeScope is a small app that quietly runs in your Windows tray and tracks **how much time you spend in each application** — Chrome, Word, games, whatever you open.
- 📊 It shows you a clean dashboard of where your day went: today, yesterday, last 7/30 days, or any custom range.
- 🔒 **It never sends a single byte over the internet.** Everything lives in one file on your own computer.
- ⌨️ **No keystrokes, no passwords, no screenshots, no message content — ever.** It only knows "you had app X open from time A to time B."
- 🌐 Website tracking is 100% optional, and even then it only logs the domain (e.g. `youtube.com`), never page content.
- 🎯 You get categories (productive / neutral / distracting), daily goals, and a focus mode that gently warns you when you drift.
- 🗑️ Pause tracking or wipe all your data anytime, with one click.
- 🆓 **Completely free and open source** — every line of code is right here for you to verify.

### 📘 Full README

**What is TimeScope?**
TimeScope is a **free, open-source, privacy-first alternative to RescueTime** for Windows. It automatically records the active desktop application (name, start time, end time, duration), detects idle time, and presents everything in a modern local dashboard — with zero network calls by design.

**What it records — and what it never records**

| ✅ Recorded (minimum metadata) | ❌ Never recorded |
|---|---|
| Active application name + process name | Keystrokes |
| Executable path (for identification) | Passwords |
| Start time, end time, duration | Clipboard contents |
| Idle periods (idle / locked / suspend) | Screenshots |
| Window title — **only if you opt in** | Message or form contents |
| Website **domain** only — **only if you opt in**, via the extension | Full URLs, page text, browsing history |

Additional controls: pause tracking (tray or Settings), exclude specific apps/domains, retention auto-cleanup, CSV/JSON export, and granular deletion (date range / browsing only / apps only / all).

**Requirements:** macOS on Apple silicon, Node.js 20+ and npm. Xcode Command Line Tools are required only when building from source, to compile the small foreground-app helper.

**Run it locally:**
```bash
git clone https://github.com/EnesAhmet10000/timescope.git
cd timescope
npm install
npm run dev        # dev mode: Vite + esbuild watch + Electron with hot reload
```

Production-style run:
```bash
npm run build      # typecheck + bundle main/preload + build renderer + generate icons
npx electron .      # run the built app
```

Build a macOS disk image:
```bash
npm run dist        # arm64 DMG in release/
```

**All commands**

| Command | What it does |
|---|---|
| `npm run dev` | Development mode with live reload |
| `npm run build` | Full production build into `dist/` |
| `npm run typecheck` | TypeScript strict-mode check |
| `npm test` | Vitest unit + integration tests (analytics, tracker state machine, DB) |
| `npm run smoke` | Automated end-to-end check: launches the built app hidden against a throwaway DB, tracks for 8 s, asserts sessions were recorded |
| `npm run dist` | arm64 macOS DMG via electron-builder |
| `npm run icons` | Regenerate tray/app icons (pure-code PNG generation) |

UI-only preview in a normal browser (fabricated data, dev-only): `npx vite --config vite.config.ts` then open `http://localhost:5183/?mock=1`.

**First run**
An onboarding wizard explains what is and is not tracked, where data is stored, and asks for explicit consent before enabling the two optional trackers (window titles, websites). Both default to **off**. The app then lives in the system tray: closing the window keeps tracking; *Quit* is in the tray menu. Enable **Start with Windows** in Settings to survive reboots (applies to the installed build).

**Browser extension (optional website tracking)**
The extension sends **only** `{ domain, startTs, endTs }` — e.g. `youtube.com`, `github.com` — to your local app over `127.0.0.1`. Never page text, titles, full URLs, forms, or history. Excluded domains are dropped inside the browser and never leave it.

Setup:
1. In TimeScope → **Settings**, enable **Track websites**. Note the port + token shown there.
2. In Chrome/Edge/Brave: `chrome://extensions` → enable *Developer mode* → *Load unpacked* → select the `extension/` folder.
3. Open the extension's **Options**, paste the port + token, add any private domains to exclude, and press **Save & test connection** — it should report "Connected to TimeScope".

The local endpoint only listens while website tracking is enabled, binds to `127.0.0.1` only, and requires the bearer token (constant-time compared). Turning **Track websites** off shuts the listener down entirely.

**Privacy model**
1. **Local-only by default.** No cloud component, no account, no telemetry, no analytics SDK. Data leaves the machine only when you explicitly export a file.
2. **Data minimization.** Only the metadata in the table above is collected. Window titles and website domains are opt-in with explicit onboarding consent, and each can be disabled at any time. Excluded apps/domains are never written to the database (dropped at the source).
3. **Untrusted boundaries.** Every IPC command validates its payload; the preload exposes a fixed channel allowlist with `contextIsolation` + `sandbox` and no Node integration. The extension endpoint binds to loopback only, requires a token, and rejects malformed or oversized bodies.
4. **User control.** Pause anytime, retention auto-delete, full or partial deletion with explicit confirmation, CSV/JSON export.

### 🏗️ Architecture & Database Schema (technical reference)

**Electron + React + TypeScript (strict) + SQLite.** Tauri was the preferred stack, but it hard-requires a Rust toolchain plus MSVC build tools; this codebase was built to compile with nothing but Node. To keep a future Tauri port cheap, the core logic (tracker state machine, analytics, schema) is dependency-injected plain TypeScript with no Electron imports.

```
src/
  shared/types.ts        Single source of truth for cross-process types (IPC schema)
  main/                  Electron main process
    index.ts             Wiring: app lifecycle, window, powerMonitor, retention job
    win32.ts             Foreground window via user32/kernel32 (koffi FFI)
    tracker.ts           Activity engine: polling, session grouping, idle state machine
    db.ts                SQLite driver wrapper + migrations
    catalog.ts            Apps/domains registry, category seeding & auto-categorization
    analytics.ts          Interval clipping, bucketing, summaries (pure functions + queries)
    focus.ts              Focus sessions with distraction warnings
    ipc.ts                Validated IPC command surface (renderer = untrusted input)
    webserver.ts           Localhost-only endpoint for the browser extension
    exporter.ts            CSV/JSON export, deletion, retention
    settings.ts             Typed, sanitized settings store
    tray.ts                 Tray icon + menu (state-aware)
  preload/index.ts        Channel-allowlisted contextBridge (no Node in renderer)
  renderer/                React dashboard (Vite): pages, charts, design system
extension/                 Chrome MV3 companion (domain + timestamps only)
tests/                     Vitest: analytics math, tracker state machine, DB integration
scripts/                   dev runner, esbuild bundling, smoke test, icon generation
```

**How tracking works**
- A 2-second poll reads the foreground window (`GetForegroundWindow` → `QueryFullProcessImageNameW`) and system idle time (`powerMonitor.getSystemIdleTime`).
- Continuous focus on one app is **one** `sessions` row; its `end_ts` is updated in place each poll, so a crash/power-loss costs at most ~2 s and never leaves dangling rows. Quick alt-tabs away and back (≤ 5 s) merge into the previous row instead of spawning duplicates; sub-second slivers are dropped.
- Idle detection is **retroactive**: when the threshold (default 5 min, configurable) is crossed, the session is truncated back to when input actually stopped and an idle period starts there.
- Lock screen, sleep, and shutdown are handled via `powerMonitor` events (`locked` / `suspend` idle kinds); tracking resumes automatically on unlock/resume.

**Database schema (SQLite, versioned migrations)**
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

All timestamps are Unix epoch milliseconds. Database file: `%APPDATA%/timescope/timescope.db` (shown in Settings).

**Tests:** `npm test` covers the pure analytics math (clipping, bucketing, summaries), the tracker state machine (grouping, merging, retroactive idle, lock screen, pause, exclusions, title opt-in), and DB integration (migrations, cascade deletes, retention, export escaping, input sanitization). `npm run smoke` exercises the real app end-to-end.

### ❓ Frequently Asked Questions

**Is TimeScope free?**
Yes — TimeScope is completely free and open source under the MIT license. No subscription, no paid tier, no ads.

**Does TimeScope send my data to the internet?**
No. There is no external network call anywhere in the codebase. All data stays in a local SQLite database on your own machine.

**Is TimeScope a good RescueTime alternative?**
Yes — if you want a privacy-first, local-only, open-source alternative to RescueTime that works offline with no cloud account, TimeScope is built exactly for that.

**How is TimeScope different from RescueTime, Rize, or ActivityWatch?**
Like ActivityWatch, TimeScope keeps 100% of your data local. Unlike closed-source cloud trackers, there is no server component at all — you can read every line of the tracking code yourself.

**Does it track keystrokes or take screenshots?**
No, never. TimeScope only records which application was in the foreground and for how long — never keystrokes, passwords, clipboard contents, or screenshots.

**Does it work on Mac or Linux?**
This build targets Apple silicon macOS. Linux is not currently supported.

---

## 🇹🇷 Türkçe

### 🙂 Basit Anlatım

- ⏱️ TimeScope, Windows'ta arka planda sessizce çalışan ve **her uygulamada ne kadar zaman geçirdiğini** (Chrome, Word, oyunlar, ne açarsan) hesaplayan küçük bir uygulama.
- 📊 Günün nereye gittiğini gösteren temiz bir panel sunar: bugün, dün, son 7/30 gün veya seçtiğin herhangi bir tarih aralığı.
- 🔒 **İnternete tek bir bayt bile göndermez.** Her şey kendi bilgisayarındaki tek bir dosyada saklanır.
- ⌨️ **Asla tuş vuruşu, şifre, ekran görüntüsü veya mesaj içeriği kaydetmez.** Sadece "X uygulaması A zamanından B zamanına kadar açıktı" bilgisini bilir.
- 🌐 Web sitesi takibi tamamen isteğe bağlıdır; açsan bile yalnızca alan adını (ör. `youtube.com`) kaydeder, sayfa içeriğini asla.
- 🎯 Kategoriler (üretken / nötr / dikkat dağıtıcı), günlük hedefler ve dikkatin dağıldığında seni nazikçe uyaran bir odak modu var.
- 🗑️ İstediğin zaman tek tıkla takibi duraklatabilir veya tüm verilerini silebilirsin.
- 🆓 **Tamamen ücretsiz ve açık kaynak** — kodun her satırı burada, kendin doğrulayabilirsin.

### 📘 Tam Açıklama

**TimeScope nedir?**
TimeScope, Windows için **ücretsiz, açık kaynaklı, gizlilik odaklı bir RescueTime alternatifidir**. Aktif masaüstü uygulamasını (ad, başlangıç/bitiş zamanı, süre) otomatik olarak kaydeder, boşta kalma süresini algılar ve her şeyi modern, tamamen yerel bir panelde sunar — hiçbir ağ isteği olmadan.

**Ne kaydeder — ne kaydetmez**

| ✅ Kaydedilen (asgari veri) | ❌ Asla kaydedilmeyen |
|---|---|
| Aktif uygulama adı + işlem adı | Tuş vuruşları |
| Yürütülebilir dosya yolu (tanımlama için) | Şifreler |
| Başlangıç, bitiş zamanı, süre | Pano (kopyala/yapıştır) içeriği |
| Boşta kalma süreleri (boşta / kilitli / uyku) | Ekran görüntüleri |
| Pencere başlığı — **yalnızca sen etkinleştirirsen** | Mesaj veya form içeriği |
| Yalnızca web sitesi **alan adı** — **isteğe bağlı**, tarayıcı eklentisiyle | Tam URL'ler, sayfa metni, tarama geçmişi |

**Gereksinimler:** Windows 10 veya 11, Node.js 20+ ve npm.

**Yerel olarak çalıştırma:**
```bash
git clone https://github.com/EnesAhmet10000/timescope.git
cd timescope
npm install
npm run dev
```

Kurulum dosyası oluşturma:
```bash
npm run build
npm run dist        # release/ klasöründe Windows NSIS kurulum dosyası
```

**İlk çalıştırma:** Açılış sihirbazı neyin izlenip neyin izlenmediğini, verilerin nerede saklandığını açıkça anlatır ve isteğe bağlı iki özelliği (pencere başlıkları, web sitesi takibi) etkinleştirmeden önce açık rızanı ister — ikisi de varsayılan olarak **kapalıdır**.

**Gizlilik modeli özetle:**
1. **Varsayılan olarak tamamen yerel** — bulut bileşeni yok, hesap yok, telemetri yok, gizli analiz SDK'sı yok.
2. **Veri minimizasyonu** — yalnızca yukarıdaki tablodaki asgari veriler toplanır; hassas özellikler açık onayla isteğe bağlıdır.
3. **Güvenilir sınırlar** — her iç komut doğrulanır; tarayıcı eklentisi yalnızca `127.0.0.1` (kendi bilgisayarın) üzerinden ve bir güvenlik anahtarıyla iletişim kurar.
4. **Tam kullanıcı kontrolü** — istediğin an duraklat, kısmi/tam silme, CSV/JSON dışa aktarma, otomatik veri saklama süresi.

### ❓ Sıkça Sorulan Sorular

**TimeScope ücretsiz mi?**
Evet, TimeScope MIT lisansı altında tamamen ücretsiz ve açık kaynaklıdır. Abonelik yok, ücretli sürüm yok.

**TimeScope verilerimi internete gönderiyor mu?**
Hayır. Kod tabanında hiçbir dış ağ isteği yoktur. Tüm veriler yalnızca kendi bilgisayarındaki yerel bir SQLite veritabanında saklanır.

**TimeScope iyi bir RescueTime alternatifi mi?**
Evet — çevrimdışı çalışan, bulut hesabı gerektirmeyen, gizlilik odaklı ve yerel bir RescueTime alternatifi arıyorsan, TimeScope tam olarak bunun için tasarlandı.

**Mac veya Linux'ta çalışıyor mu?**
Mevcut sürüm yalnızca Windows 10/11 için oluşturulmuştur. Temel izleme ve analiz mantığı, gelecekteki çapraz platform (Tauri) taşımasını kolaylaştırmak için Electron'dan bağımsız tutulmuştur.

---

## 🧠 The Original Build Prompt / البرومت الأصلي / Orijinal Geliştirme Promptu

This is the exact specification prompt used to design and build TimeScope from scratch with Claude (Anthropic), kept here for transparency and reproducibility.

هذا هو نص التوجيه (البرومت) الأصلي الذي استُخدم لتصميم وبناء TimeScope من الصفر باستخدام Claude من Anthropic، محفوظ هنا للشفافية وإمكانية إعادة البناء.

TimeScope'u sıfırdan Claude (Anthropic) ile tasarlamak ve inşa etmek için kullanılan orijinal talimat metni, şeffaflık ve tekrar üretilebilirlik için burada saklanmaktadır.

```
Build a production-ready desktop application similar in purpose to RescueTime, focused on privacy-first automatic time tracking.

The app should track how much time the user spends in desktop applications and optionally on websites, then present the data in a clean local dashboard.

Core requirements:

1. Platform
   Build the first version for Windows 10 and Windows 11.

2. Privacy
   Privacy is the highest priority.
   All activity data must stay locally on the user's computer by default.
   Do not record:
   - Keystrokes
   - Passwords
   - Clipboard contents
   - Screenshots
   - Message contents
   - Form contents
   - Private page contents

   The app should only collect the minimum metadata necessary for time tracking, such as:
   - Active application name
   - Executable/process name
   - Window title, with a privacy option to disable window-title tracking
   - Start time
   - End time
   - Duration
   - Optional website domain only, not full page content

   Clearly separate local-only functionality from any optional future cloud-sync feature.

3. Automatic activity tracking
   The background service should:
   - Detect which application is currently active
   - Record when the active app changes
   - Calculate exact time spent in each app
   - Detect idle time after a configurable period
   - Exclude idle time from active usage statistics
   - Resume tracking automatically when activity returns
   - Continue working after reboot
   - Run efficiently in the system tray
   - Avoid high CPU, RAM, or battery usage

4. Website tracking
   Create an optional browser extension for Chrome and Chromium-based browsers.
   The extension should:
   - Track the active tab domain
   - Send only the domain and timestamps to the local desktop application
   - Never collect page text, passwords, form data, or browsing content
   - Allow the user to disable website tracking completely
   - Allow excluded/private websites

5. Dashboard
   Create a modern, clean dashboard showing Today (total active time, idle time, most-used
   apps/websites, hourly timeline), Views (Today / Yesterday / Last 7 days / Last 30 days /
   Custom range), and Charts (time by app, by category, by website, daily trend, hour-by-hour).
   Use a polished modern interface inspired by RescueTime, Rize, Linear, Raycast, and modern
   analytics dashboards, but do not copy proprietary branding, layouts, assets, or code.

6. Categories
   Allow users to categorize apps and websites (Productive, Communication, Development,
   Browsing, Entertainment, Social Media, Video, Education, Uncategorized), create custom
   categories, change any assignment, and mark categories as productive/neutral/distracting.

7. Goals
   Optional goals (e.g. "less than 1 hour on social media", "at least 3 hours on development")
   with visible progress.

8. Focus mode
   25/45/60/custom-length focus sessions, select distracting categories to warn about, a
   countdown timer, and a post-session review. Warnings are acceptable instead of full blocking
   for v1.

9. Local database
   Use SQLite. Design a clean schema for applications, websites, activity sessions, categories,
   category assignments, idle periods, goals, focus sessions, and settings. Prevent excessive
   duplicate records by grouping continuous activity intelligently.

10. Architecture
    Prefer Tauri + React + TypeScript + Rust + SQLite for lower resource usage; Electron + React
    + TypeScript as a fallback if Tauri creates major limitations. Structure the project into
    clear modules: activity tracking, idle detection, database, analytics, API/backend commands,
    UI, browser extension, settings, system tray.

11. Windows activity detection
    Reliable foreground-window tracking using appropriate Windows APIs, handling fast app
    switching, locked screen, sleep/wake, shutdown, crashes, and unexpected restarts, without
    storing sensitive information unnecessarily.

12. Idle detection
    Native Windows idle-time APIs, default 5-minute threshold (configurable), ending the active
    session and starting an idle period on idle, resuming normal tracking on return.

13. System tray
    Start with Windows, minimize to tray, pause/resume tracking, open dashboard, quit — with a
    tray icon that clearly shows tracking state.

14. Settings
    Start with Windows, idle timeout, window-title tracking on/off, website tracking on/off,
    data retention, excluded apps, excluded websites, export data, delete all data, pause
    tracking, theme (system/light/dark).

15. Data export
    CSV and JSON export, including only the user's own local data.

16. Data deletion
    Delete selected date range, browsing data only, application data only, or all local data —
    with confirmation required before destructive actions.

17. Security
    Validate all local IPC commands, avoid unnecessary local network ports, prefer
    application-internal IPC, protect the local database from accidental remote access, no
    hidden telemetry, no analytics/tracking SDKs without explicit consent.

18. User interface
    Premium, simple interface with navigation for Overview, Timeline, Applications, Websites,
    Categories, Goals, Focus, Settings. Overview page: large "Today" summary, total active time,
    productive time, distracting time, top apps, top websites, timeline chart. Responsive cards,
    clean typography, subtle shadows, rounded corners, strong spacing, accessible contrast.

19. First-run onboarding
    Explain what the app tracks, what it does not track, where data is stored, how to pause
    tracking, and that website/window-title tracking are optional — asking for consent before
    enabling any optional tracking.

20. Development workflow
    Inspect the environment, create the architecture, write a concise implementation plan, set
    up the project, and build the smallest working vertical slice first (launch the app, detect
    the active Windows application, store activity sessions in SQLite, detect idle time, show
    today's app usage). Then add timeline, categories, browser extension, goals, focus mode,
    export and deletion tools.

21. Code quality
    TypeScript strict mode, strong typing, clear error handling, modular code, database
    migrations, unit tests for analytics/session aggregation, integration tests for database
    operations. Avoid giant files, hardcoded sample data in production, fake backend
    functionality, placeholder buttons that do nothing, unnecessary dependencies.

22. Deliverables
    Full source code, README, setup instructions, development commands, build instructions,
    architecture explanation, privacy model, database schema, browser-extension setup
    instructions — with the README explaining exactly how to run the app locally.

23. Important execution rule
    Actually create the project files, implement the code, run the application where possible,
    fix build errors, test the core functionality, and continue until the first working version
    is functional — do not stop after scaffolding.

Start by creating a production-quality MVP called "TimeScope" as a temporary working name, with
branding kept isolated so the product can easily be renamed later. The final result should feel
like a privacy-first alternative to RescueTime, not a clone.
```

---

## 📣 Suggested Promotional Texts / نصوص ترويجية مقترحة / Önerilen Tanıtım Metinleri

Ready-to-use copy for launching TimeScope on Product Hunt, Reddit, X/Twitter, LinkedIn, or Hacker News.

### 🇬🇧 English

**Short (X/Twitter, ~250 chars):**
> 🕒 TimeScope — a free, open-source, privacy-first RescueTime alternative for Windows. No cloud, no account, no telemetry. Every second of tracking data stays on your machine. 100% local. 100% yours. ⭐ github.com/EnesAhmet10000/timescope

**Medium (Reddit / LinkedIn):**
> TimeScope, a free and open-source time tracking app for Windows that works like RescueTime — but takes privacy seriously. It automatically tracks which apps (and optionally which website domains) you use, shows a clean local dashboard with categories, goals, and focus sessions — and never sends a single byte to the internet. No keystrokes, no passwords, no screenshots, ever. Everything lives in a local SQLite file you fully control. Would love feedback! 🕒

**Product Hunt tagline:**
> TimeScope — Track your time, not your privacy. A local-only, open-source RescueTime alternative for Windows.

**Hacker News title:**
> Show HN: TimeScope – an open-source, local-only RescueTime alternative for Windows

### 🇸🇦 العربية

**قصير (تويتر/إكس):**
> 🕒 TimeScope — بديل مجاني ومفتوح المصدر لبرنامج RescueTime، مصمم للخصوصية أولاً. بدون سحابة، بدون حساب، بدون تتبع خفي. كل بياناتك تبقى على جهازك فقط. ⭐ github.com/EnesAhmet10000/timescope

**متوسط (منشور تفصيلي):**
>  TimeScope، برنامج مجاني ومفتوح المصدر لتتبع الوقت على ويندوز، يشتغل مثل RescueTime لكن يأخذ الخصوصية على محمل الجد. يتتبع تلقائياً التطبيقات التي تستخدمها (والمواقع اختيارياً)، ويعرض لك لوحة تحكم أنيقة فيها تصنيفات وأهداف ووضع تركيز — وكل هذا بدون إرسال أي بيانات للإنترنت أبداً. لا كيبورد، لا كلمات مرور، لا لقطات شاشة. كل شي محفوظ محلياً بملف SQLite تتحكم فيه بالكامل. يسعدني أي رأي أو ملاحظة! 🕒

**عنوان لمنصة تقنية:**
> TimeScope — تتبّع وقتك، لا خصوصيتك. بديل محلي ومفتوح المصدر لبرنامج RescueTime مخصص لويندوز.

### 🇹🇷 Türkçe

**Kısa (X/Twitter):**
> 🕒 TimeScope — Windows için ücretsiz, açık kaynaklı, gizlilik odaklı bir RescueTime alternatifi. Bulut yok, hesap yok, telemetri yok. Tüm izleme verileri kendi bilgisayarında kalır. %100 yerel, %100 senin. ⭐ github.com/EnesAhmet10000/timescope

**Orta (Reddit / LinkedIn):**
> TimeScope — RescueTime gibi çalışan ama gizliliği ciddiye alan, ücretsiz ve açık kaynaklı bir Windows zaman takip uygulaması. Kullandığın uygulamaları (ve isteğe bağlı olarak web sitesi alan adlarını) otomatik olarak izler, kategoriler, hedefler ve odak modu içeren temiz bir yerel panel sunar — ve asla internete tek bir veri göndermez. Tuş vuruşu yok, şifre yok, ekran görüntüsü yok. Her şey tamamen senin kontrolünde olan yerel bir SQLite dosyasında saklanır. Geri bildirimlerinizi bekliyorum! 🕒

**Tanıtım sloganı:**
> TimeScope — Zamanını takip et, gizliliğini değil. Windows için yerel, açık kaynaklı bir RescueTime alternatifi.

---

<p align="center">Made with ❤️ for privacy — TimeScope is free, open source, and always local-first.</p>
