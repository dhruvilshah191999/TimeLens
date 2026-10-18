/**
 * Shared types for TimeLens.
 * All time values are stored in milliseconds; formatting happens only at the
 * display layer.
 */

/** Intent category id. Phase 1 ships these defaults; configurable in Settings. */
export type IntentId =
  | 'learning'
  | 'work'
  | 'entertainment'
  | 'social'
  | 'news'
  | 'shopping'
  | 'other'

export interface Category {
  /** Stable id used as a key in aggregates, e.g. "learning". */
  id: string
  /** Human label, e.g. "Learning". */
  label: string
  /** Hex color for charts. */
  color: string
  /** Lineicons name (without the `lni-` prefix). */
  icon: string
}

/**
 * A single contiguous span of attention on one page.
 * Created when a tab/url becomes active, finalized when focus moves away.
 */
export interface Session {
  id: string
  /** e.g. "youtube.com" */
  domain: string
  /** full URL at session end */
  url: string
  /** page title at session end */
  title: string
  /** unix ms */
  startedAt: number
  /** unix ms */
  endedAt: number
  /** endedAt - startedAt */
  durationMs: number
  /** classified intent (Phase 2) */
  intent?: string
  /** 0-1 (Phase 2) */
  intentConfidence?: number
  /** Which engine produced the intent: keyword rules or on-device AI. */
  intentSource?: 'rule' | 'ai'
}

export interface Settings {
  /** Seconds of inactivity before tracking pauses. */
  idleThresholdSec: number
  /** Domains the user has chosen to never track. */
  excludedDomains: string[]
  /** Master tracking toggle. */
  trackingEnabled: boolean
  /** Phase 2 — AI intent classification toggle. */
  classificationEnabled: boolean
  /** Intent categories. */
  categories: Category[]
}

/**
 * Pre-aggregated per-day totals for fast popup/dashboard loads.
 * We never recompute from raw sessions on the hot path.
 */
export interface DailyTotal {
  /** "2026-06-03" (local date) */
  date: string
  totalMs: number
  byDomain: Record<string, number>
  /** Phase 2 */
  byIntent: Record<string, number>
  /** Number of (merged) sessions counted toward this day. */
  sessionCount: number
}

/** Ephemeral state for the in-progress session, kept in chrome.storage.session. */
export interface ActiveSession {
  domain: string
  url: string
  title: string
  startedAt: number
  tabId: number
  windowId: number
  /**
   * Last time we confirmed the system was awake and this session live (updated
   * by a periodic heartbeat). Used to discard time across sleep/suspend gaps —
   * we never credit time past lastSeenAt when a large gap is detected.
   */
  lastSeenAt: number
  /**
   * Set when the browser loses focus (alt-tab to another app, or our popup
   * opening). Accrual freezes at this moment; if focus returns to the same tab
   * the session resumes (the paused gap is not counted), otherwise it's
   * finalized at pausedAt. Absent while actively focused.
   */
  pausedAt?: number
}
