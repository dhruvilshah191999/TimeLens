/** Keys used in chrome.storage.local / chrome.storage.session. */
export const STORAGE_KEYS = {
  /** Session[] — raw finalized sessions (chrome.storage.local). */
  SESSIONS: 'sessions',
  /** Settings — user settings (chrome.storage.local). */
  SETTINGS: 'settings',
  /** Record<string, DailyTotal> keyed by date (chrome.storage.local). */
  DAILY_TOTALS: 'daily-totals',
  /** ActiveSession | null — current in-progress session (chrome.storage.session). */
  ACTIVE_SESSION: 'active-session',
  /** Session[] — write buffer not yet flushed to SESSIONS (chrome.storage.session). */
  SESSION_BUFFER: 'session-buffer',
  /** number — intent backfill schema version that has been applied. */
  INTENT_VERSION: 'intent-version',
  /** AiProgress — on-device model download state (chrome.storage.session). */
  AI_DOWNLOAD: 'ai-download',
} as const

/** chrome.alarms names. */
export const ALARM_NAMES = {
  /** Aggregate buffered sessions into daily totals. */
  AGGREGATE: 'aggregate-daily-totals',
  /** Delete sessions older than the retention window. */
  CLEANUP: 'cleanup-old-sessions',
  /** Refresh the active session's lastSeenAt; detect sleep/suspend gaps. */
  HEARTBEAT: 'heartbeat',
} as const

/** chrome.contextMenus item ids. */
export const CONTEXT_MENU_IDS = {
  EXCLUDE_SITE: 'exclude-site',
} as const
