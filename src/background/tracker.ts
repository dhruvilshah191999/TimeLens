import {
  ACTIVE_GAP_MAX_MS,
  MIN_IDLE_THRESHOLD_SEC,
  MIN_SESSION_MS,
} from '@/lib/constants'
import { domainFromUrl } from '@/lib/time-utils'
import type { ActiveSession, Session } from '@/lib/types'
import { classify } from './classifier'
import {
  flushBuffer,
  getActiveSession,
  getSettings,
  pushToBuffer,
  setActiveSession,
} from './storage'

interface TabLike {
  id?: number
  windowId?: number
  url?: string
  title?: string
}

function isTrackableUrl(url: string | undefined): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'))
}

/**
 * Time credited to an active session right now: from startedAt up to the
 * earliest of — pausedAt (focus lost), lastSeenAt (if a sleep gap is detected),
 * or now. Never counts paused or slept time.
 */
export function activeElapsedMs(active: ActiveSession): number {
  const now = Date.now()
  let end = active.pausedAt ?? now
  if (now - active.lastSeenAt > ACTIVE_GAP_MAX_MS) {
    end = Math.min(end, active.lastSeenAt)
  }
  return Math.max(0, end - active.startedAt)
}

/**
 * Mark the session live again after activity. If it was paused, shift startedAt
 * forward by the paused gap so that idle time isn't counted and the elapsed
 * value continues unchanged (the "Now" timer never jumps back). Mutates active.
 */
function resume(active: ActiveSession): void {
  const now = Date.now()
  if (active.pausedAt != null) {
    active.startedAt += now - active.pausedAt
    active.pausedAt = undefined
  }
  active.lastSeenAt = now
}

/**
 * Finalize the in-progress session. Sessions shorter than MIN_SESSION_MS are
 * discarded as noise. Idempotent — safe to call when nothing is active.
 */
export async function endActiveSession(): Promise<void> {
  const active = await getActiveSession()
  if (!active) return
  // Clear first so concurrent events can't double-finalize the same session.
  await setActiveSession(null)

  // Credit only awake, focused time (excludes paused and slept gaps).
  const durationMs = activeElapsedMs(active)
  const endedAt = active.startedAt + durationMs
  if (durationMs < MIN_SESSION_MS) return

  const session: Session = {
    id: crypto.randomUUID(),
    domain: active.domain,
    url: active.url,
    title: active.title,
    startedAt: active.startedAt,
    endedAt,
    durationMs,
  }

  // Classify intent (Phase 2). Rules are instant; the AI tier only runs when the
  // user opted in and the rule guess is shaky, and never throws (falls back to
  // rules), so this can't lose the session.
  try {
    const { classificationEnabled } = await getSettings()
    const result = await classify(
      { domain: session.domain, url: session.url, title: session.title },
      classificationEnabled,
    )
    session.intent = result.intent
    session.intentConfidence = result.confidence
    session.intentSource = result.source
  } catch {
    // Leave the session unclassified; backfill/reclassify can fill it in later.
  }

  // Persist immediately (and merge with the previous same-domain session) so
  // the dashboard's recent sessions and weekly totals stay current. The write
  // is tiny — one finalized session per page visit.
  await pushToBuffer(session)
  await flushBuffer()
}

/** Begin tracking a tab, honoring tracking toggle and the exclusion list. */
export async function startSession(tab: TabLike): Promise<void> {
  const settings = await getSettings()
  if (!settings.trackingEnabled) return
  if (!isTrackableUrl(tab.url)) return

  const domain = domainFromUrl(tab.url ?? '')
  if (!domain || settings.excludedDomains.includes(domain)) return

  const now = Date.now()
  const active: ActiveSession = {
    domain,
    url: tab.url ?? '',
    title: tab.title || domain,
    startedAt: now,
    tabId: tab.id ?? -1,
    windowId: tab.windowId ?? -1,
    lastSeenAt: now,
  }
  await setActiveSession(active)
}

/**
 * Track whatever tab is active now. If that's the same page we're already
 * tracking, keep the running clock (just refresh metadata) instead of starting
 * a fresh session — this avoids fragmenting on focus changes that don't move
 * the user to a new page.
 */
export async function switchToActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  const active = await getActiveSession()
  if (
    tab &&
    active &&
    active.tabId === tab.id &&
    domainFromUrl(tab.url ?? '') === active.domain
  ) {
    // Same page — resume the running session (continues without resetting).
    resume(active)
    active.url = tab.url ?? active.url
    if (tab.title) active.title = tab.title
    await setActiveSession(active)
    return
  }
  await endActiveSession()
  if (tab) await startSession(tab)
}

// ---------------------------------------------------------------------------
// Event handlers (registered in index.ts)
// ---------------------------------------------------------------------------

export async function handleTabActivated(
  activeInfo: chrome.tabs.TabActiveInfo,
): Promise<void> {
  await endActiveSession()
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    await startSession(tab)
  } catch {
    // Tab may have closed before we could read it; nothing to track.
  }
}

export async function handleWindowFocusChanged(
  windowId: number,
): Promise<void> {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus — alt-tab to another app, OR our own popup opening.
    // Pause (freeze accrual) rather than end: if focus returns to the same tab
    // we resume seamlessly, so opening the popup no longer restarts the timer.
    const active = await getActiveSession()
    if (active && active.pausedAt == null) {
      active.pausedAt = Date.now()
      await setActiveSession(active)
    }
    return
  }
  await switchToActiveTab()
}

/** True if the tab is currently playing audio (video/call/music). */
async function isTabAudible(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId)
    return tab.audible === true
  } catch {
    return false
  }
}

export async function handleIdleStateChanged(
  state: chrome.idle.IdleState,
): Promise<void> {
  if (state === 'active') {
    await switchToActiveTab()
    return
  }
  // 'idle' or 'locked' — keep counting if media is playing (video/call/music).
  // Otherwise PAUSE (freeze accrual) rather than end, so coming back resumes the
  // SAME session and the "Now" timer doesn't reset. The session is only
  // finalized on a real context change (different domain/tab, close, or sleep).
  const active = await getActiveSession()
  if (!active || active.pausedAt != null) return
  if (await isTabAudible(active.tabId)) return
  active.pausedAt = Date.now()
  await setActiveSession(active)
}

/**
 * Periodic heartbeat. While awake it refreshes the active session's
 * lastSeenAt. If a large gap is detected (machine was asleep/suspended, so no
 * heartbeats fired), it finalizes the session crediting only up to lastSeenAt —
 * never the sleep gap — and resumes tracking the focused tab if the user is back.
 */
export async function handleHeartbeat(): Promise<void> {
  const active = await getActiveSession()
  if (!active) return

  const now = Date.now()
  if (now - active.lastSeenAt > ACTIVE_GAP_MAX_MS) {
    // endActiveSession caps the credited end time at lastSeenAt.
    await endActiveSession()
    const state = await chrome.idle.queryState(MIN_IDLE_THRESHOLD_SEC)
    if (state === 'active') await switchToActiveTab()
    return
  }

  active.lastSeenAt = now
  await setActiveSession(active)
}

/**
 * SPA route change (YouTube video switch, Twitter feed, etc.). We keep the
 * session running across same-domain navigations — only a real DOMAIN change
 * starts a new session, so the "Now" timer doesn't reset when you switch
 * videos. Metadata (url/title) is refreshed in place.
 */
export async function handleHistoryStateUpdated(
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
): Promise<void> {
  if (details.frameId !== 0) return // top frame only
  const active = await getActiveSession()
  if (!active || active.tabId !== details.tabId) return // only the tracked tab

  const newDomain = domainFromUrl(details.url)
  if (newDomain && newDomain !== active.domain) {
    await endActiveSession()
    try {
      const tab = await chrome.tabs.get(details.tabId)
      await startSession(tab)
    } catch {
      // Tab closed mid-navigation.
    }
    return
  }

  // Same domain (e.g. next YouTube video) — keep counting, just refresh.
  resume(active)
  if (details.url) active.url = details.url
  await setActiveSession(active)
}

/**
 * Keep the active session fresh as a tab loads. Also handles the case where a
 * tab was activated before its URL was available (new tab, slow load): the
 * session couldn't start then, so we start it once the URL arrives here.
 */
export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  // We only track the focused tab; ignore background tabs loading.
  if (!tab.active) return

  const active = await getActiveSession()

  // Media stopped (paused/ended) on the tracked tab. If the user is also idle,
  // they've stopped watching while away — PAUSE (freeze) the clock. We don't
  // end here, so resuming continues the same session without resetting.
  if (changeInfo.audible === false && active && active.tabId === tabId) {
    const { idleThresholdSec } = await getSettings()
    const state = await chrome.idle.queryState(
      Math.max(MIN_IDLE_THRESHOLD_SEC, idleThresholdSec),
    )
    if (state !== 'active' && active.pausedAt == null) {
      active.pausedAt = Date.now()
      await setActiveSession(active)
    }
    return
  }

  const onTrackedTab = active != null && active.tabId === tabId

  // Title-only / non-navigational update for the tab we're tracking.
  if (!changeInfo.url && changeInfo.status !== 'complete') {
    if (onTrackedTab && active && changeInfo.title) {
      active.title = changeInfo.title
      await setActiveSession(active)
    }
    return
  }

  // A URL is now known (full nav, SPA, or load completed).
  const newDomain = domainFromUrl(tab.url ?? '')

  if (onTrackedTab && active && newDomain === active.domain) {
    // Same site — keep the clock running (resume if paused), refresh metadata.
    resume(active)
    active.url = tab.url ?? active.url
    if (tab.title) active.title = tab.title
    await setActiveSession(active)
    return
  }

  // Different tab, different domain, or no session yet — start fresh.
  await endActiveSession()
  await startSession(tab)
}

export async function handleTabRemoved(tabId: number): Promise<void> {
  const active = await getActiveSession()
  if (active && active.tabId === tabId) await endActiveSession()
}
