# Chrome Web Store listing — TimeLens 1.0.0

Copy each section into the matching field of the Developer Dashboard.

## Store listing tab

**Name**
TimeLens

**Summary** (max 132 characters)
See where your browsing time goes, by intent: Work, Learning, Social and more. Private by design, everything stays on your device.

**Category**
Productivity

**Language**
English

**Description**

Most time trackers tell you that you spent 3 hours on YouTube. TimeLens tells you that 2 hours of that was Learning and 1 hour was Entertainment, because the same site means different things at different times.

WHAT YOU GET
• Today view: your total time, a split by intent, and a 24-hour ribbon showing when you worked, learned or drifted.
• Same site, different reasons: each site shows how its time divides across intents.
• Trends: daily bars by intent for the last 7 or 30 days, plus what changed compared with the previous period.
• Popup: today at a glance, the page you are on right now and how it was labelled.
• Light and dark themes.

HOW PAGES GET A LABEL
• Keyword rules: 120+ known sites plus title keywords. Instant and always on.
• Optional Gemini Nano: on Chrome builds that include the on-device Prompt API, unclear pages can be labelled by Chrome's built-in AI model. It runs on your device; nothing is sent to a server.

ACCURATE BY DEFAULT
• Only the focused tab counts.
• Tracking pauses when you are idle or switch to another app; audible tabs (videos, calls) keep counting.
• Time across sleep or suspend is never credited.

PRIVATE BY DESIGN
• All data is stored locally in your browser. No account, no server, no analytics.
• Exclude any site from Settings or by right-clicking a page and choosing "Stop tracking this site".
• Export everything as JSON or delete it with one click. Sessions older than 90 days are removed automatically.

## Graphic assets (store/assets)

| Field | File |
| --- | --- |
| Store icon (128×128) | `icon-128.png` |
| Screenshot 1 | `01-today-1280x800.png` |
| Screenshot 2 | `02-popup-1280x800.png` |
| Screenshot 3 | `03-trends-1280x800.png` |
| Screenshot 4 | `04-today-dark-1280x800.png` |
| Screenshot 5 | `05-settings-1280x800.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `marquee-1400x560.png` |

Screenshots use sample data from the demo harness (`store/demo`), not real browsing history.

## Privacy practices tab

**Single purpose**
TimeLens measures how long you spend on websites and groups that time by intent (such as Work, Learning or Entertainment) so you can see where your browsing time goes.

**Permission justifications**

- `tabs`: Reads the URL and title of the active tab to know which site you are on and to label it by intent.
- `idle`: Pauses tracking when you step away from the computer so idle time is not counted.
- `webNavigation`: Detects in-page navigation on single-page sites (for example switching videos) so each page is timed and labelled separately.
- `alarms`: Runs periodic tasks: saving buffered sessions, a heartbeat that prevents counting time across sleep, and removing data older than 90 days.
- `storage`: Stores sessions, daily totals and settings locally in the browser.
- `contextMenus`: Adds a "Stop tracking this site" item to the right-click menu.
- `favicon`: Shows site icons from Chrome's local favicon cache, without any network request.

**Remote code**
No, I am not using remote code.

**Data usage**
- Data collected: tick **Web history**. The extension reads the URL and title of the pages you visit, but stores them only on your device.
- Certify all three: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL**
https://dhruvilshah191999.github.io/TimeLens/privacy.html

(Source: `docs/privacy.html`, served by GitHub Pages from the `/docs` folder on `main`.)
