import {
  ACTIVE_GAP_MAX_MS,
  MIN_IDLE_THRESHOLD_SEC,
  MIN_SESSION_MS,
} from '@/lib/constants'
import { domainFromUrl } from '@/lib/time-utils'
import type { ActiveSession, Session } from '@/lib/types'
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
 * Finalize the in-progress session. Sessions shorter than MIN_SESSION_MS are
 * discarded as noise. Idempotent — safe to call when nothing is active.
 */
export async function endActiveSession(): Promise<void> {
  const active = await getActiveSession()
  if (!active) return
  // Clear first so concurrent events can't double-finalize the same session.
  await setActiveSession(null)

  // If a large gap has elapsed since the last heartbeat, the machine was
  // asleep/suspended — credit time only up to lastSeenAt, not across the gap.
  const now = Date.now()
  const endedAt =
    now - active.lastSeenAt > ACTIVE_GAP_MAX_MS ? active.lastSeenAt : now
  const durationMs = endedAt - active.startedAt
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
    active.url = tab.url ?? active.url
    if (tab.title) active.title = tab.title
    active.lastSeenAt = Date.now()
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
    // Browser lost focus (user alt-tabbed to another app).
    await endActiveSession()
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
  // 'idle' or 'locked' — keep counting if the active tab is playing media
  // (video/call/music): the user is passively engaged. We stop the clock when
  // playback ends (handleTabUpdated audible change) or when they return.
  const active = await getActiveSession()
  if (active && (await isTabAudible(active.tabId))) return
  await endActiveSession()
  await flushBuffer()
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

/** domain + path of a URL, used to detect real navigations vs. SPA noise. */
function pagePath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname}`
  } catch {
    return url
  }
}

/** SPA route change (YouTube video switch, Twitter feed, etc.). */
export async function handleHistoryStateUpdated(
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
): Promise<void> {
  if (details.frameId !== 0) return // top frame only
  const active = await getActiveSession()
  if (!active || active.tabId !== details.tabId) return // only the tracked tab

  // Players (Netflix etc.) fire history updates constantly during playback with
  // no real path change. Only split the session on an actual page change.
  if (pagePath(details.url) === pagePath(active.url)) return

  await endActiveSession()
  try {
    const tab = await chrome.tabs.get(details.tabId)
    await startSession(tab)
  } catch {
    // Tab closed mid-navigation.
  }
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
  // they've stopped watching while away — stop the clock now. If they're still
  // present we keep counting (they may be reading the paused page).
  if (changeInfo.audible === false && active && active.tabId === tabId) {
    const { idleThresholdSec } = await getSettings()
    const state = await chrome.idle.queryState(
      Math.max(MIN_IDLE_THRESHOLD_SEC, idleThresholdSec),
    )
    if (state !== 'active') {
      await endActiveSession()
      await flushBuffer()
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
    // Same site — just refresh url/title without resetting the clock.
    active.url = tab.url ?? active.url
    if (tab.title) active.title = tab.title
    active.lastSeenAt = Date.now()
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
