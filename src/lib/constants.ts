import type { Category, Settings } from './types'

/** Sessions shorter than this are noise (quick tab flips) and discarded. */
export const MIN_SESSION_MS = 5_000

/** Default idle detection interval, in seconds. */
export const DEFAULT_IDLE_THRESHOLD_SEC = 60

/** chrome.idle minimum allowed detection interval is 15s. */
export const MIN_IDLE_THRESHOLD_SEC = 15
export const MAX_IDLE_THRESHOLD_SEC = 300

/** Raw sessions older than this are deleted on cleanup. */
export const RETENTION_DAYS = 90

/**
 * Consecutive sessions on the SAME domain that end/restart within this gap are
 * merged into one when persisted — coalesces churn from SPA navigations, focus
 * changes, and pause/resume into a single clean entry. Durations are summed
 * (gap time is excluded), so totals are unaffected.
 */
export const SESSION_MERGE_GAP_MS = 30 * 60 * 1000

/** How often (minutes) the aggregate alarm runs. */
export const AGGREGATE_INTERVAL_MIN = 5

/** How often (minutes) the cleanup alarm runs. */
export const CLEANUP_INTERVAL_MIN = 60 * 12

/** How often (minutes) the heartbeat refreshes the active session's lastSeenAt. */
export const HEARTBEAT_INTERVAL_MIN = 1

/**
 * If the gap since the active session's lastSeenAt exceeds this, the machine
 * was asleep/suspended (or the worker was frozen) — we credit time only up to
 * lastSeenAt, never across the gap. Must exceed the heartbeat interval + slack.
 */
export const ACTIVE_GAP_MAX_MS = 150_000

/** Flush the session buffer to local storage at least this often (ms). */
export const BUFFER_FLUSH_MS = 30_000

/**
 * Intent categories, in display order (focused intents first). Colors are CSS
 * variables defined in globals.css so they adapt to light/dark themes.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', label: 'Work', color: 'var(--intent-work)', icon: 'work' },
  {
    id: 'learning',
    label: 'Learning',
    color: 'var(--intent-learning)',
    icon: 'learning',
  },
  { id: 'news', label: 'News', color: 'var(--intent-news)', icon: 'news' },
  {
    id: 'social',
    label: 'Social',
    color: 'var(--intent-social)',
    icon: 'social',
  },
  {
    id: 'shopping',
    label: 'Shopping',
    color: 'var(--intent-shopping)',
    icon: 'shopping',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    color: 'var(--intent-entertainment)',
    icon: 'entertainment',
  },
  { id: 'other', label: 'Other', color: 'var(--intent-other)', icon: 'other' },
]

/** Intents that count toward the "focused" share. */
export const FOCUS_INTENTS = ['work', 'learning']

/** Quick lookup of a category by its intent id (falls back to "Other"). */
export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.id, c]),
)

export const OTHER_CATEGORY =
  DEFAULT_CATEGORIES.find((c) => c.id === 'other') ?? DEFAULT_CATEGORIES[0]

/** Resolve a category for an intent id, defaulting to "Other". */
export function categoryFor(intent: string | undefined): Category {
  return (intent && CATEGORY_BY_ID[intent]) || OTHER_CATEGORY
}

export const DEFAULT_SETTINGS: Settings = {
  idleThresholdSec: DEFAULT_IDLE_THRESHOLD_SEC,
  excludedDomains: [],
  trackingEnabled: true,
  classificationEnabled: false,
  categories: DEFAULT_CATEGORIES,
}
