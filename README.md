# TimeLens

A privacy-first browser time tracker that classifies your time by **intent**, not just by domain.

Most time trackers tell you "you spent 4h on YouTube." TimeLens tells you "3h of that was Learning, 1h was Entertainment" — because the same site means different things at different times. Each page is labelled from its title and URL by a keyword ruleset, optionally refined by Chrome's **on-device** Gemini Nano.

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

## ✨ Features

- ⏱️ **Accurate tracking** — only the focused tab counts; pauses on idle (configurable, default 60s) and when the browser loses focus; audible tabs keep counting; never credits time across sleep/suspend.
- 🏷️ **Intent labels** — Work, Learning, News, Social, Shopping, Entertainment, Other. Keyword rules (120+ known sites + title keywords) run instantly; for unclear pages, Gemini Nano can refine the label on-device. AI answers are cached per page so a page keeps one label.
- 🔀 **Same site, different reasons** — sessions only merge when site *and* intent match, so a YouTube tutorial and a comedy clip stay separate.
- 📊 **Today** — total time, split by intent, a 24-hour day ribbon, per-site intent splits, sessions grouped by day.
- 📈 **Trends** — 7/30-day stacked bars by intent, comparison with the previous period, top sites.
- 🧩 **Popup** — today at a glance, the current page and how it was labelled (rule or Nano).
- 🚫 Exclude sites via right-click or Settings; export JSON; delete everything; 90-day auto-cleanup.
- 🌙 Light and dark themes.

---

## 🛠️ Tech stack

- **Manifest V3** Chrome extension
- **React 19** + **TypeScript** (strict)
- **Vite** + **@crxjs/vite-plugin** (HMR during dev)
- **Tailwind CSS** + **shadcn/ui** components
- **date-fns** (time math), **React Router** (dashboard); charts are plain CSS — no chart library
- Fonts (Schibsted Grotesk, Martian Mono) bundled locally via **@fontsource** — no runtime network requests
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

The lens icons are generated procedurally (zero deps):

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
│   └── classifier.ts  # intent classification: keyword rules + on-device Gemini Nano
├── popup/             # toolbar popup (React)
├── dashboard/         # full-tab options page (React + React Router)
├── components/        # shared UI (intent bars, day ribbon, icons, switch)
├── lib/               # shared types, constants, time utils
└── styles/            # Tailwind globals + design tokens
store/                 # Chrome Web Store listing copy, assets and screenshot harness
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
