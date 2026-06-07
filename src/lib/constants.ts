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

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'learning',
    label: 'Learning',
    color: '#3b82f6',
    icon: 'graduation-cap-1',
  },
  { id: 'work', label: 'Work', color: '#8b5cf6', icon: 'briefcase-1' },
  {
    id: 'entertainment',
    label: 'Entertainment',
    color: '#ec4899',
    icon: 'play',
  },
  { id: 'social', label: 'Social', color: '#f97316', icon: 'user-multiple-4' },
  { id: 'news', label: 'News', color: '#eab308', icon: 'book-1' },
  { id: 'shopping', label: 'Shopping', color: '#22c55e', icon: 'cart-1' },
  { id: 'other', label: 'Other', color: '#6b7280', icon: 'layers-1' },
]

export const DEFAULT_SETTINGS: Settings = {
  idleThresholdSec: DEFAULT_IDLE_THRESHOLD_SEC,
  excludedDomains: [],
  trackingEnabled: true,
  classificationEnabled: false,
  categories: DEFAULT_CATEGORIES,
}

/** Palette for domain charts when no category color applies. */
export const CHART_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#ef4444',
  '#6b7280',
]
