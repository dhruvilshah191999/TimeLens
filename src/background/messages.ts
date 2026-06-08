import type { DailyTotal, Session, Settings } from '@/lib/types'

/**
 * Typed message bus between UI (popup/dashboard) and the background service
 * worker. The service worker may be asleep; chrome.runtime.sendMessage wakes it.
 */

export type Message =
  | { type: 'GET_TODAY' }
  | { type: 'GET_TODAY_HOURLY' }
  | { type: 'GET_DAILY_RANGE'; startDate: string; endDate: string }
  | { type: 'GET_RECENT_SESSIONS'; limit: number }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'GET_STATUS' }
  | { type: 'SET_TRACKING'; enabled: boolean }
  | { type: 'EXCLUDE_DOMAIN'; domain: string }
  | { type: 'INCLUDE_DOMAIN'; domain: string }
  | { type: 'EXPORT_DATA' }
  | { type: 'RESET_DATA' }

export interface StatusResponse {
  trackingEnabled: boolean
  isTracking: boolean
  currentDomain: string | null
  currentUrl: string | null
  /** Elapsed ms of the in-progress session (capped; excludes paused/slept time). */
  sessionElapsedMs: number | null
}

export interface ExportPayload {
  exportedAt: number
  version: string
  sessions: Session[]
  dailyTotals: Record<string, DailyTotal>
  settings: Settings
}

/** Maps each message type to its response shape. */
export interface ResponseMap {
  GET_TODAY: DailyTotal
  /** 24 buckets of tracked ms, indexed by local hour (0–23). */
  GET_TODAY_HOURLY: number[]
  GET_DAILY_RANGE: DailyTotal[]
  GET_RECENT_SESSIONS: Session[]
  GET_SETTINGS: Settings
  UPDATE_SETTINGS: Settings
  GET_STATUS: StatusResponse
  SET_TRACKING: StatusResponse
  EXCLUDE_DOMAIN: Settings
  INCLUDE_DOMAIN: Settings
  EXPORT_DATA: ExportPayload
  RESET_DATA: { ok: true }
}

/** Typed wrapper around chrome.runtime.sendMessage for UI callers. */
export async function sendMessage<M extends Message>(
  message: M,
): Promise<ResponseMap[M['type']]> {
  return chrome.runtime.sendMessage(message)
}
