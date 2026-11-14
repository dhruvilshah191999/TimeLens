import type { DailyTotal, Session, Settings } from '@/lib/types'
import type { AiProgress } from './classifier'

/**
 * Typed message bus between UI (popup/dashboard) and the background service
 * worker. The service worker may be asleep; chrome.runtime.sendMessage wakes it.
 */

export type Message =
  | { type: 'GET_TODAY' }
  | { type: 'GET_DAILY_RANGE'; startDate: string; endDate: string }
  | { type: 'GET_RECENT_SESSIONS'; limit: number }
  | { type: 'GET_SESSIONS_RANGE'; startDate: string; endDate: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'GET_STATUS' }
  | { type: 'SET_TRACKING'; enabled: boolean }
  | { type: 'EXCLUDE_DOMAIN'; domain: string }
  | { type: 'INCLUDE_DOMAIN'; domain: string }
  | { type: 'EXPORT_DATA' }
  | { type: 'RESET_DATA' }
  | { type: 'GET_AI_STATUS' }
  | { type: 'RECLASSIFY_ALL' }

export interface StatusResponse {
  trackingEnabled: boolean
  isTracking: boolean
  currentDomain: string | null
  currentUrl: string | null
  currentTitle: string | null
  /** Live intent of the in-progress page (rules, or a cached AI answer). */
  currentIntent: string | null
  currentIntentSource: 'rule' | 'ai' | null
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
  GET_DAILY_RANGE: DailyTotal[]
  GET_RECENT_SESSIONS: Session[]
  /**
   * Sessions that started within [startDate, endDate] (local date keys),
   * including buffered ones and the in-progress session, oldest first.
   */
  GET_SESSIONS_RANGE: Session[]
  GET_SETTINGS: Settings
  UPDATE_SETTINGS: Settings
  GET_STATUS: StatusResponse
  SET_TRACKING: StatusResponse
  EXCLUDE_DOMAIN: Settings
  INCLUDE_DOMAIN: Settings
  EXPORT_DATA: ExportPayload
  RESET_DATA: { ok: true }
  GET_AI_STATUS: AiStatusResponse
  RECLASSIFY_ALL: { ok: true; count: number }
}

/** On-device AI (Gemini Nano) availability for the Settings UI. */
export interface AiStatusResponse {
  /** 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' */
  availability: string
  /** Whether the user has turned smart classification on. */
  enabled: boolean
  /** Live model-download progress (state + 0–1 fraction). */
  download: AiProgress
}

/** Typed wrapper around chrome.runtime.sendMessage for UI callers. */
export async function sendMessage<M extends Message>(
  message: M,
): Promise<ResponseMap[M['type']]> {
  return chrome.runtime.sendMessage(message)
}
