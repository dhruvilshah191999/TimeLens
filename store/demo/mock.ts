/**
 * Store-listing demo harness: fakes the clock and the extension message bus
 * with deterministic sample data, so the real UI components can be rendered
 * and screenshotted without exposing anyone's actual browsing history.
 */
import type { DailyTotal, Session, Settings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/constants'

// --- Fixed clock: Wednesday 14 Oct 2026, 16:20 local -----------------------
const FIXED_NOW = new Date(2026, 9, 14, 16, 20, 0).getTime()
const RealDate = Date
class FakeDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(FIXED_NOW)
    else super(...(args as [number]))
  }
  static now() {
    return FIXED_NOW
  }
}
;(globalThis as unknown as { Date: DateConstructor }).Date =
  FakeDate as unknown as DateConstructor

// --- Sample data ------------------------------------------------------------
type Page = [domain: string, intent: string, title: string]
const PAGES: Record<string, Page[]> = {
  work: [
    ['github.com', 'work', 'Pull request #214 · acme/web-app'],
    ['github.com', 'work', 'Issues · acme/web-app'],
    ['linear.app', 'work', 'ENG-482 Billing page polish'],
    ['mail.google.com', 'work', 'Inbox'],
    ['docs.google.com', 'work', 'Q4 roadmap draft'],
    ['figma.com', 'work', 'Checkout redesign'],
    ['localhost', 'work', 'Acme dev server'],
  ],
  learning: [
    ['developer.mozilla.org', 'learning', 'Array.prototype.reduce()'],
    ['youtube.com', 'learning', 'React Server Components, explained'],
    ['react.dev', 'learning', 'Synchronizing with Effects'],
    ['coursera.org', 'learning', 'Machine Learning · Week 3'],
    ['chatgpt.com', 'learning', 'Explain database indexes'],
  ],
  social: [
    ['linkedin.com', 'social', 'Feed'],
    ['reddit.com', 'social', 'r/webdev'],
    ['x.com', 'social', 'Home'],
  ],
  entertainment: [
    ['youtube.com', 'entertainment', 'Late night stand-up set'],
    ['netflix.com', 'entertainment', 'Netflix'],
    ['open.spotify.com', 'entertainment', 'Focus Flow playlist'],
  ],
  news: [
    ['news.ycombinator.com', 'news', 'Hacker News'],
    ['theverge.com', 'news', 'The Verge'],
  ],
  shopping: [['amazon.com', 'shopping', 'Mechanical keyboard']],
  other: [['weather.com', 'other', '10-day forecast']],
}

/** Deterministic PRNG so every render produces identical screenshots. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const MIN = 60_000
let nextId = 0
function session(start: number, minutes: number, page: Page): Session {
  const durationMs = minutes * MIN
  return {
    id: `s${nextId++}`,
    domain: page[0],
    url: `https://${page[0]}/`,
    title: page[2],
    startedAt: start,
    endedAt: start + durationMs,
    durationMs,
    intent: page[1],
    intentConfidence: 0.9,
    intentSource: 'rule',
  }
}

/** Today: a hand-shaped day so the ribbon reads well. [hour, minutes, intent, pageIndex] */
const TODAY_PLAN: [number, number, string, number][] = [
  [9.2, 18, 'work', 3],
  [9.55, 22, 'work', 0],
  [10.0, 34, 'learning', 0],
  [10.6, 11, 'social', 0],
  [11.1, 40, 'work', 2],
  [11.8, 28, 'work', 6],
  [12.6, 14, 'entertainment', 0],
  [13.5, 41, 'learning', 1],
  [14.25, 21, 'work', 4],
  [14.9, 13, 'social', 1],
  [15.15, 26, 'learning', 2],
  [15.62, 7, 'news', 0],
  [15.75, 23, 'work', 0],
]

function buildSessions(): Session[] {
  const out: Session[] = []
  const today = new RealDate(FIXED_NOW)
  today.setHours(0, 0, 0, 0)
  const dayStart = today.getTime()
  for (const [h, m, intent, i] of TODAY_PLAN) {
    out.push(session(dayStart + h * 60 * MIN, m, PAGES[intent][i]))
  }
  // Earlier days: weekday-heavy work, weekend-heavy leisure.
  const rand = rng(7)
  for (let d = 1; d <= 34; d++) {
    const start = dayStart - d * 24 * 60 * MIN
    const dow = new RealDate(start).getDay()
    const weekend = dow === 0 || dow === 6
    const weights: [string, number][] = weekend
      ? [['entertainment', 4], ['social', 3], ['learning', 2], ['shopping', 1], ['news', 1], ['other', 1]]
      : [['work', 6], ['learning', 3], ['social', 1.5], ['news', 1], ['entertainment', 1], ['other', 0.5]]
    const total = weights.reduce((a, [, w]) => a + w, 0)
    let t = start + (8.5 + rand() * 1.5) * 60 * MIN
    const count = 6 + Math.floor(rand() * (weekend ? 5 : 9))
    for (let k = 0; k < count; k++) {
      let r = rand() * total
      let intent = weights[0][0]
      for (const [id, w] of weights) {
        r -= w
        if (r <= 0) {
          intent = id
          break
        }
      }
      const pages = PAGES[intent]
      const minutes = 6 + Math.round(rand() * 38)
      out.push(session(t, minutes, pages[Math.floor(rand() * pages.length)]))
      t += (minutes + 4 + rand() * 40) * MIN
    }
  }
  return out.sort((a, b) => a.startedAt - b.startedAt)
}

const SESSIONS = buildSessions()
const dateKey = (ts: number) => {
  const d = new RealDate(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dailyTotals(): DailyTotal[] {
  const days = new Map<string, DailyTotal>()
  for (const s of SESSIONS) {
    const date = dateKey(s.startedAt)
    const day = days.get(date) ?? {
      date,
      totalMs: 0,
      byDomain: {},
      byIntent: {},
      sessionCount: 0,
    }
    day.totalMs += s.durationMs
    day.sessionCount++
    day.byDomain[s.domain] = (day.byDomain[s.domain] ?? 0) + s.durationMs
    const intent = s.intent ?? 'other'
    day.byIntent[intent] = (day.byIntent[intent] ?? 0) + s.durationMs
    days.set(date, day)
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}
const DAILY = dailyTotals()

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  classificationEnabled: true,
  excludedDomains: ['bank.example.com', 'health.example.org'],
}

type Msg = { type: string; [k: string]: unknown }
function respond(m: Msg): unknown {
  switch (m.type) {
    case 'GET_TODAY':
      return DAILY.find((d) => d.date === dateKey(FIXED_NOW))
    case 'GET_DAILY_RANGE':
      return DAILY.filter(
        (d) => d.date >= (m.startDate as string) && d.date <= (m.endDate as string),
      )
    case 'GET_SESSIONS_RANGE':
      return SESSIONS.filter((s) => {
        const d = dateKey(s.startedAt)
        return d >= (m.startDate as string) && d <= (m.endDate as string)
      })
    case 'GET_RECENT_SESSIONS':
      return [...SESSIONS]
        .sort((a, b) => b.endedAt - a.endedAt)
        .slice(0, m.limit as number)
    case 'GET_STATUS':
      return {
        trackingEnabled: true,
        isTracking: true,
        currentDomain: 'github.com',
        currentUrl: 'https://github.com/',
        currentTitle: 'Pull request #214 · acme/web-app',
        currentIntent: 'work',
        currentIntentSource: 'rule',
        sessionElapsedMs: 12 * MIN + 4000,
      }
    case 'GET_SETTINGS':
    case 'UPDATE_SETTINGS':
    case 'EXCLUDE_DOMAIN':
    case 'INCLUDE_DOMAIN':
      return SETTINGS
    case 'GET_AI_STATUS':
      return {
        availability: 'available',
        enabled: true,
        download: { state: 'ready', progress: 1 },
      }
    default:
      return { ok: true, count: 0 }
  }
}

;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: async (m: Msg) => respond(m),
    // No favicon cache in the demo: SiteIcon falls back to monogram tiles.
    getURL: (p: string) => `http://favicon.invalid${p}`,
    openOptionsPage: () => {},
  },
}
