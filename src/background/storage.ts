import {
  DEFAULT_SETTINGS,
  RETENTION_DAYS,
  SESSION_MERGE_GAP_MS,
} from '@/lib/constants'
import { STORAGE_KEYS } from '@/lib/storage-keys'
import { dateKey } from '@/lib/time-utils'
import type { ActiveSession, DailyTotal, Session, Settings } from '@/lib/types'
import type { AiProgress, ClassifyResult } from './classifier'

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

async function setSessions(sessions: Session[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: sessions })
}

/**
 * Append sessions, merging each into the previous one when it has the same domain
 * and intent within SESSION_MERGE_GAP_MS. Keeps "Recent sessions" clean without affecting
 * totals (durations are summed; the bridged gap is not counted).
 */
async function appendSessions(sessions: Session[]): Promise<void> {
  if (sessions.length === 0) return
  const existing = await getSessions()
  for (const s of sessions) {
    const last = existing[existing.length - 1]
    // Same intent is required: merging a tutorial with a meme video on the
    // same site would collapse two intents into one record.
    const canMerge =
      last &&
      last.domain === s.domain &&
      last.intent === s.intent &&
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
// Intent classification (Phase 2)
// ---------------------------------------------------------------------------

/** Bump when the classification scheme changes to trigger a one-time backfill. */
const INTENT_SCHEMA_VERSION = 1

async function getIntentVersion(): Promise<number> {
  const r = await chrome.storage.local.get(STORAGE_KEYS.INTENT_VERSION)
  return (r[STORAGE_KEYS.INTENT_VERSION] as number | undefined) ?? 0
}

/** True until the current backfill version has been applied. */
export async function needsIntentBackfill(): Promise<boolean> {
  return (await getIntentVersion()) < INTENT_SCHEMA_VERSION
}

/** On-device model download progress (ephemeral, chrome.storage.session). */
export async function getAiProgress(): Promise<AiProgress | null> {
  const r = await chrome.storage.session.get(STORAGE_KEYS.AI_DOWNLOAD)
  return (r[STORAGE_KEYS.AI_DOWNLOAD] as AiProgress | undefined) ?? null
}

export async function setAiProgress(p: AiProgress): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEYS.AI_DOWNLOAD]: p })
}

/**
 * Recompute the byIntent maps for exactly the days the given sessions cover,
 * then persist both sessions and totals. Days with no sessions present (e.g.
 * older than the retention window) keep their previously aggregated intent.
 */
async function persistAndRebuildIntents(sessions: Session[]): Promise<void> {
  const totals = await getDailyTotals()
  const touchedDates = new Set(sessions.map((s) => dateKey(s.startedAt)))
  for (const d of touchedDates) {
    const day = totals[d]
    if (day) day.byIntent = {}
  }
  for (const s of sessions) {
    if (!s.intent) continue
    const day = totals[dateKey(s.startedAt)]
    if (!day) continue
    day.byIntent[s.intent] = (day.byIntent[s.intent] ?? 0) + s.durationMs
  }
  await setSessions(sessions)
  await setDailyTotals(totals)
}

/**
 * Classify stored sessions with the supplied classifier, rebuild the daily
 * byIntent maps, and mark the backfill version as applied.
 * @param onlyUnclassified skip sessions that already have an intent.
 * @returns number of sessions (re)classified.
 */
export async function reclassifyAll(
  classifier: (s: Session) => Promise<ClassifyResult> | ClassifyResult,
  onlyUnclassified: boolean,
): Promise<number> {
  const sessions = await getSessions()
  let count = 0
  for (const s of sessions) {
    if (onlyUnclassified && s.intent) continue
    const r = await classifier(s)
    s.intent = r.intent
    s.intentConfidence = r.confidence
    s.intentSource = r.source
    count++
  }
  await persistAndRebuildIntents(sessions)
  await chrome.storage.local.set({
    [STORAGE_KEYS.INTENT_VERSION]: INTENT_SCHEMA_VERSION,
  })
  return count
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
