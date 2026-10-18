# Store assets

Everything needed for the Chrome Web Store listing.

- `listing.md` — listing copy, permission justifications and privacy answers.
- `assets/` — icon, five 1280×800 screenshots, small promo tile and marquee.
- `demo/` — a harness that renders the real popup and dashboard components
  against deterministic sample data (fixed clock, fake message bus), so
  screenshots never contain anyone's real browsing history.

## Regenerating the screenshots

```bash
# 1. Start the harness (http://localhost:5199)
npx vite --config vite.store.config.ts

# 2. Capture each shot with headless Chrome, e.g.
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=5000 --window-size=1280,800 \
  --screenshot=store/assets/01-today-1280x800.png \
  "http://localhost:5199/?shot=today"
```

Shots: `today`, `popup`, `trends`, `settings`, `promo-small` (440×280),
`marquee` (1400×560). Add `&theme=dark` for the dark theme.

## Packaging

```bash
pnpm build
# zip the CONTENTS of dist/ (manifest.json must be at the zip root)
```
