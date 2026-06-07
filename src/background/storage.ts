import {
  DEFAULT_SETTINGS,
  RETENTION_DAYS,
  SESSION_MERGE_GAP_MS,
} from '@/lib/constants'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { dateKey } from '@/lib/time-utils'
import type { ActiveSession, DailyTotal, Session, Settings } from '@/lib/types'

/**
 * Typed wrappers around chrome.storage. Persistent data lives in
 * chrome.storage.local; ephemeral per-browser-session state (the in-progress
 * session and the unflushed write buffer) lives in chrome.storage.session.
 *
 * MV3 service workers are killed after ~30s idle, so NOTHING is cached in
 * module-level variables — every read hits storage.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined
  // Merge with defaults so new fields added across versions are populated.
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next: Settings = { ...current, ...patch }
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: next })
  return next
}

// ---------------------------------------------------------------------------
// Raw sessions (persistent)
// ---------------------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS)
  return (result[STORAGE_KEYS.SESSIONS] as Session[] | undefined) ?? []
}

/**
 * Append sessions, merging each into the previous one when it's the same domain
 * within SESSION_MERGE_GAP_MS. Keeps "Recent sessions" clean without affecting
 * totals (durations are summed; the bridged gap is not counted).
 */
async function appendSessions(sessions: Session[]): Promise<void> {
  if (sessions.length === 0) return
  const existing = await getSessions()
  for (const s of sessions) {
    const last = existing[existing.length - 1]
    const canMerge =
      last &&
      last.domain === s.domain &&
      s.startedAt >= last.startedAt &&
      s.startedAt - last.endedAt <= SESSION_MERGE_GAP_MS
    if (canMerge) {
      last.durationMs += s.durationMs
      last.endedAt = Math.max(last.endedAt, s.endedAt)
      last.url = s.url
      last.title = s.title
    } else {
      existing.push(s)
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: existing })
}

// ---------------------------------------------------------------------------
// Daily totals (persistent, pre-aggregated)
// ---------------------------------------------------------------------------

export async function getDailyTotals(): Promise<Record<string, DailyTotal>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_TOTALS)
  return (
    (result[STORAGE_KEYS.DAILY_TOTALS] as
      | Record<string, DailyTotal>
      | undefined) ?? {}
  )
}

async function setDailyTotals(
  totals: Record<string, DailyTotal>,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_TOTALS]: totals })
}

function emptyDailyTotal(date: string): DailyTotal {
  return { date, totalMs: 0, byDomain: {}, byIntent: {}, sessionCount: 0 }
}

/** Fold one session into a daily-totals map (mutates and returns it). */
function foldSession(
  totals: Record<string, DailyTotal>,
  session: Session,
): Record<string, DailyTotal> {
  const date = dateKey(session.startedAt)
  const day = totals[date] ?? emptyDailyTotal(date)
  day.totalMs += session.durationMs
  day.sessionCount += 1
  day.byDomain[session.domain] =
    (day.byDomain[session.domain] ?? 0) + session.durationMs
  if (session.intent) {
    day.byIntent[session.intent] =
      (day.byIntent[session.intent] ?? 0) + session.durationMs
  }
  totals[date] = day
  return totals
}

// ---------------------------------------------------------------------------
// Ephemeral: active session (chrome.storage.session)
// ---------------------------------------------------------------------------

export async function getActiveSession(): Promise<ActiveSession | null> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.ACTIVE_SESSION)
  return (
    (result[STORAGE_KEYS.ACTIVE_SESSION] as ActiveSession | null | undefined) ??
    null
  )
}

export async function setActiveSession(
  session: ActiveSession | null,
): Promise<void> {
  await chrome.storage.session.set({
    [STORAGE_KEYS.ACTIVE_SESSION]: session,
  })
}

// ---------------------------------------------------------------------------
// Ephemeral: write buffer (chrome.storage.session)
// ---------------------------------------------------------------------------

export async function getBuffer(): Promise<Session[]> {
  const result = await chrome.storage.session.get(STORAGE_KEYS.SESSION_BUFFER)
  return (result[STORAGE_KEYS.SESSION_BUFFER] as Session[] | undefined) ?? []
}

export async function pushToBuffer(session: Session): Promise<number> {
  const buffer = await getBuffer()
  buffer.push(session)
  await chrome.storage.session.set({ [STORAGE_KEYS.SESSION_BUFFER]: buffer })
  return buffer.length
}

/**
 * Persist buffered sessions: append raw sessions to local storage and fold
 * them into the pre-aggregated daily totals, then clear the buffer.
 * Safe to call when the buffer is empty.
 */
export async function flushBuffer(): Promise<void> {
  const buffer = await getBuffer()
  if (buffer.length === 0) return

  const totals = await getDailyTotals()
  for (const session of buffer) foldSession(totals, session)

  await appendSessions(buffer)
  await setDailyTotals(totals)
  await chrome.storage.session.set({ [STORAGE_KEYS.SESSION_BUFFER]: [] })
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/** Delete raw sessions older than the retention window. Daily totals are kept. */
export async function cleanupOldSessions(): Promise<number> {
  const sessions = await getSessions()
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const kept = sessions.filter((s) => s.endedAt >= cutoff)
  const removed = sessions.length - kept.length
  if (removed > 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: kept })
  }
  return removed
}

export async function resetAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.SESSIONS,
    STORAGE_KEYS.DAILY_TOTALS,
  ])
  await chrome.storage.session.remove([
    STORAGE_KEYS.SESSION_BUFFER,
    STORAGE_KEYS.ACTIVE_SESSION,
  ])
}
