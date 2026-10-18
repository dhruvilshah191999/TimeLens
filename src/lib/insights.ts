import { differenceInCalendarDays, format } from 'date-fns'
import { DEFAULT_CATEGORIES, FOCUS_INTENTS } from './constants'
import type { Session } from './types'

const INTENT_ORDER = DEFAULT_CATEGORIES.map((c) => c.id)

/** Sort intent ids in palette order (focused intents first, Other last). */
function intentRank(id: string): number {
  const i = INTENT_ORDER.indexOf(id)
  return i === -1 ? INTENT_ORDER.length : i
}

/**
 * Instrument-style duration: "45s", "38m", "4h 04m". Minutes are zero-padded
 * once hours appear so stacked readouts line up.
 */
export function formatHM(ms: number): string {
  if (ms <= 0) return '0m'
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const totalMin = Math.floor(totalSec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Signed delta for comparisons: "+12m", "−1h 05m". */
export function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '−'
  return `${sign}${formatHM(Math.abs(ms))}`
}

/** Share of time on focused intents (Work + Learning), or null with no data. */
export function focusShare(byIntent: Record<string, number>): number | null {
  const total = Object.values(byIntent).reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const focus = FOCUS_INTENTS.reduce((a, id) => a + (byIntent[id] ?? 0), 0)
  return Math.round((focus / total) * 100)
}

/** Ordered, non-empty intent segments for a byIntent map. */
export function intentSegments(byIntent: Record<string, number>) {
  const total = Object.values(byIntent).reduce((a, b) => a + b, 0)
  return DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    ms: byIntent[c.id] ?? 0,
    pct: total > 0 ? Math.round(((byIntent[c.id] ?? 0) / total) * 100) : 0,
  })).filter((s) => s.ms > 0)
}

export interface SiteSplit {
  domain: string
  /** Most recent page URL, for local favicon lookups. */
  url: string
  totalMs: number
  parts: { intent: string; ms: number }[]
}

/**
 * Per-site totals split by intent — the "same site, different reasons" view
 * (e.g. YouTube as both Learning and Entertainment). Sorted by total time.
 */
export function siteSplits(sessions: Session[]): SiteSplit[] {
  const sites = new Map<string, SiteSplit & { byIntent: Map<string, number> }>()
  for (const s of sessions) {
    let site = sites.get(s.domain)
    if (!site) {
      site = {
        domain: s.domain,
        url: s.url,
        totalMs: 0,
        parts: [],
        byIntent: new Map(),
      }
      sites.set(s.domain, site)
    }
    site.totalMs += s.durationMs
    site.url = s.url
    const intent = s.intent ?? 'other'
    site.byIntent.set(intent, (site.byIntent.get(intent) ?? 0) + s.durationMs)
  }
  return [...sites.values()]
    .map(({ byIntent, ...site }) => ({
      ...site,
      parts: [...byIntent.entries()]
        .map(([intent, ms]) => ({ intent, ms }))
        .sort((a, b) => intentRank(a.intent) - intentRank(b.intent)),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

/** Sum session time by intent. */
export function byIntentOf(sessions: Session[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sessions) {
    const id = s.intent ?? 'other'
    out[id] = (out[id] ?? 0) + s.durationMs
  }
  return out
}

/** "Today", "Yesterday · Sat 17 Oct", or "Thu 15 Oct". */
export function dayLabel(ts: number, now = Date.now()): string {
  const diff = differenceInCalendarDays(now, ts)
  if (diff === 0) return 'Today'
  if (diff === 1) return `Yesterday · ${format(ts, 'EEE d MMM')}`
  return format(ts, 'EEE d MMM')
}

/** Group sessions (newest first) under day labels, preserving order. */
export function groupByDay(
  sessions: Session[],
): { day: string; items: Session[] }[] {
  const groups: { day: string; items: Session[] }[] = []
  for (const s of sessions) {
    const day = dayLabel(s.startedAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(s)
    else groups.push({ day, items: [s] })
  }
  return groups
}

/**
 * Busiest 3-hour window of the day and the first activity time, from session
 * spans. Returns null when nothing was tracked.
 */
export function dayRhythm(
  sessions: Session[],
): { busiest: string; first: string } | null {
  if (sessions.length === 0) return null
  const hours = new Array(24).fill(0)
  for (const s of sessions) {
    // Spread active time across the hours it actually covers.
    let t = s.startedAt
    const end = s.startedAt + s.durationMs
    while (t < end) {
      const d = new Date(t)
      const nextHour = new Date(d).setMinutes(60, 0, 0)
      const slice = Math.min(end, nextHour) - t
      hours[d.getHours()] += slice
      t += slice
    }
  }
  let best = 0
  let bestStart = 0
  for (let h = 0; h <= 21; h++) {
    const sum = hours[h] + hours[h + 1] + hours[h + 2]
    if (sum > best) {
      best = sum
      bestStart = h
    }
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = Math.min(...sessions.map((s) => s.startedAt))
  return {
    busiest: `${pad(bestStart)}:00–${pad(bestStart + 3)}:00`,
    first: format(first, 'HH:mm'),
  }
}
