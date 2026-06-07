# TimeLens

A privacy-first browser time tracker that classifies your time by **intent**, not just by domain.

Most time trackers tell you "you spent 4h on YouTube." TimeLens aims to tell you "3h of that was Learning, 1h was Entertainment" — because the same site means different things at different times. Intent classification is auto-derived from the page title + URL using **on-device AI** (Chrome's built-in Gemini Nano), with graceful fallbacks. (Classification ships in Phase 2 — see status below.)

All your data stays in your browser. No servers, no telemetry, no accounts.

---

## 🔒 Privacy Manifesto

- **All browsing data stays in your browser** (`chrome.storage.local`). Nothing is ever uploaded.
- **AI classification runs on-device** (Gemini Nano) by default.
- **External AI is opt-in only.** If you choose the Groq fallback, it uses *your own* API key — never ours.
- **No telemetry, no analytics, no remote logging.** Ever.
- **You own your data.** Export everything as JSON anytime; delete everything with one click.
- **Open source.** Read the code; it does what it says.

---

## 📦 Phase status

This is a personal portfolio project built in phases.

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **Phase 1** | Core tracking: per-domain time, idle/focus pause, SPA handling, popup + dashboard, exclusions, export/reset | ✅ **Done (this build)** |
| **Phase 2** | On-device AI intent classification (Gemini Nano → Groq → keyword rules) | ⏳ Planned |
| **Phase 3** | Insights, trends, goals, onboarding, dark mode, animations | ⏳ Planned |

### What works in Phase 1

- ⏱️ Accurate per-domain time tracking via `chrome.tabs`, `chrome.windows`, `chrome.idle`.
- 😴 Auto-pause when you're idle (configurable threshold, default 60s) or when the browser loses focus.
- 🔀 SPA-aware: detects in-page route changes (YouTube video switches, etc.) via `chrome.webNavigation.onHistoryStateUpdated`.
- 🧹 Sessions shorter than 5s are discarded as noise; raw sessions auto-pruned after 90 days.
- 📊 Popup: today's total + donut of top sites + tracking toggle.
- 📈 Dashboard: Overview (today's bars + recent sessions), Weekly (7-day trend + top sites), Settings.
- 🚫 Exclude any site from tracking via right-click ("Stop tracking this site") or Settings.
- 💾 Export all data as JSON; wipe all data.

### What's stubbed / deferred

- 🤖 **Intent classification** (`src/background/classifier.ts`) is a no-op stub — Phase 2.
- ✨ **Insights** dashboard page is a placeholder explaining what's coming.
- 🌙 Dark mode CSS variables exist but there's no toggle yet (Phase 3).

---

## 🛠️ Tech stack

- **Manifest V3** Chrome extension
- **React 19** + **TypeScript** (strict)
- **Vite** + **@crxjs/vite-plugin** (HMR during dev)
- **Tailwind CSS** + **shadcn/ui** components
- **Recharts** (charts), **date-fns** (time math), **React Router** (dashboard)
- **Zustand** available for state (Phase 1 keeps state in the service worker)
- **Biome** (lint/format), **pnpm**

---

## 🚀 Install for development

Requires **Node 20+** and **pnpm 9+**.

```bash
pnpm install
pnpm dev          # starts Vite with HMR; writes an unpacked extension to dist/
```

Then load it into Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the **`dist/`** folder

With `pnpm dev` running, edits hot-reload automatically. For a production build:

```bash
pnpm build        # type-checks then builds to dist/ (ready for the Web Store)
```

### Regenerating icons

The clock icons are generated procedurally (zero deps):

```bash
pnpm icons
```

---

## 📁 Project layout

```
src/
├── background/        # MV3 service worker
│   ├── index.ts       # entry: registers listeners, alarms, context menu, messaging
│   ├── tracker.ts     # session lifecycle (start/end on tab/focus/idle/SPA events)
│   ├── storage.ts     # typed chrome.storage wrappers + daily-total aggregation
│   ├── idle-handler.ts# applies idle detection threshold from settings
│   ├── messages.ts    # typed message bus (UI <-> background)
│   └── classifier.ts  # intent classification — STUB (Phase 2)
├── popup/             # toolbar popup (React)
├── dashboard/         # full-tab options page (React + React Router)
├── components/ui/     # shadcn/ui components
├── lib/               # shared types, constants, time utils
└── styles/            # Tailwind globals
```

---

## 🧪 How tracking works

A **session** is one contiguous span of attention on one page. The service worker
starts a session when a tab/URL becomes active and finalizes it when focus moves
away (tab switch, window blur, idle, SPA navigation, or tab close). Finalized
sessions are buffered in `chrome.storage.session` and periodically flushed into
both a raw `sessions` log and a pre-aggregated `daily-totals` map for fast reads.

Because MV3 kills the service worker after ~30s idle, **no state is held in
memory** — every event reads from and writes to `chrome.storage`. Today's total
in the popup is computed live (persisted totals + buffered sessions + the elapsed
time of the in-progress session), so it's always current.

---

## 📄 License

MIT — personal portfolio project.
