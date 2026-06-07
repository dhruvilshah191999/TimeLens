import {
  ACTIVE_GAP_MAX_MS,
  AGGREGATE_INTERVAL_MIN,
  CLEANUP_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MIN,
} from '@/lib/constants'
import { ALARM_NAMES, CONTEXT_MENU_IDS } from '@/lib/storage-keys'
import { domainFromUrl } from '@/lib/time-utils'
import { dateKey } from '@/lib/time-utils'
import type { DailyTotal } from '@/lib/types'
import { applyIdleThreshold } from './idle-handler'
import type { Message, ResponseMap } from './messages'
import {
  cleanupOldSessions,
  flushBuffer,
  getActiveSession,
  getBuffer,
  getDailyTotals,
  getSessions,
  getSettings,
  resetAllData,
  setSettings,
} from './storage'
import {
  endActiveSession,
  handleHeartbeat,
  handleHistoryStateUpdated,
  handleIdleStateChanged,
  handleTabActivated,
  handleTabRemoved,
  handleTabUpdated,
  handleWindowFocusChanged,
  switchToActiveTab,
} from './tracker'

// ---------------------------------------------------------------------------
// Lifecycle: install / startup
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  // Persist defaults on first run, and apply idle threshold from settings.
  await setSettings({})
  await applyIdleThreshold()

  chrome.alarms.create(ALARM_NAMES.AGGREGATE, {
    periodInMinutes: AGGREGATE_INTERVAL_MIN,
  })
  chrome.alarms.create(ALARM_NAMES.CLEANUP, {
    periodInMinutes: CLEANUP_INTERVAL_MIN,
  })
  chrome.alarms.create(ALARM_NAMES.HEARTBEAT, {
    periodInMinutes: HEARTBEAT_INTERVAL_MIN,
  })

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.EXCLUDE_SITE,
      title: 'Stop tracking this site',
      contexts: ['page', 'action'],
    })
  })

  // Seed a session for the tab that's already focused at startup/install —
  // otherwise tracking wouldn't begin until the next tab switch or navigation.
  await switchToActiveTab()
}

/**
 * Ensure a session exists for the currently focused tab. The popup calls this
 * (via GET_TODAY) on open, so even after the service worker is killed and
 * restarted with no active session, opening the popup resumes tracking.
 */
async function ensureActiveSession(): Promise<void> {
  const active = await getActiveSession()
  if (!active) await switchToActiveTab()
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap()
})
chrome.runtime.onStartup.addListener(() => {
  void bootstrap()
})

// ---------------------------------------------------------------------------
// Tracking events
// ---------------------------------------------------------------------------

chrome.tabs.onActivated.addListener((info) => {
  void handleTabActivated(info)
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  void handleWindowFocusChanged(windowId)
})

chrome.idle.onStateChanged.addListener((state) => {
  void handleIdleStateChanged(state)
})

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  void handleHistoryStateUpdated(details)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void handleTabUpdated(tabId, changeInfo, tab)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void handleTabRemoved(tabId)
})

// ---------------------------------------------------------------------------
// Alarms
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAMES.AGGREGATE) {
    void flushBuffer()
  } else if (alarm.name === ALARM_NAMES.CLEANUP) {
    void cleanupOldSessions()
  } else if (alarm.name === ALARM_NAMES.HEARTBEAT) {
    void handleHeartbeat()
  }
})

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_IDS.EXCLUDE_SITE) return
  const url = info.pageUrl ?? tab?.url ?? ''
  const domain = domainFromUrl(url)
  if (!domain) return
  void (async () => {
    const settings = await getSettings()
    if (!settings.excludedDomains.includes(domain)) {
      await setSettings({
        excludedDomains: [...settings.excludedDomains, domain],
      })
    }
    // If we're currently tracking that domain, stop now.
    const active = await getActiveSession()
    if (active?.domain === domain) await endActiveSession()
  })()
})

// ---------------------------------------------------------------------------
// Messaging (UI <-> background)
// ---------------------------------------------------------------------------

/**
 * Compute today's totals live: persisted daily total + buffered (not yet
 * aggregated) sessions + the elapsed time of the in-progress session.
 */
async function getTodayLive(): Promise<DailyTotal> {
  const today = dateKey(Date.now())
  const totals = await getDailyTotals()
  const base = totals[today]
  // Clone so we don't mutate stored data.
  const live: DailyTotal = {
    date: today,
    totalMs: base?.totalMs ?? 0,
    byDomain: { ...(base?.byDomain ?? {}) },
    byIntent: { ...(base?.byIntent ?? {}) },
    sessionCount: base?.sessionCount ?? 0,
  }

  // Fold in finalized sessions still sitting in the write buffer (ended but not
  // yet flushed into the persisted daily total). Without this the popup freezes
  // at the last-flushed value and only jumps every few minutes.
  const buffer = await getBuffer()
  for (const s of buffer) {
    if (dateKey(s.startedAt) !== today) continue
    live.totalMs += s.durationMs
    live.sessionCount += 1
    live.byDomain[s.domain] = (live.byDomain[s.domain] ?? 0) + s.durationMs
    if (s.intent) {
      live.byIntent[s.intent] = (live.byIntent[s.intent] ?? 0) + s.durationMs
    }
  }

  // Fold in the elapsed time of the active session, capped so a sleep/suspend
  // gap (no heartbeats) is never counted.
  const active = await getActiveSession()
  if (active && dateKey(active.startedAt) === today) {
    const now = Date.now()
    const end =
      now - active.lastSeenAt > ACTIVE_GAP_MAX_MS ? active.lastSeenAt : now
    const elapsed = end - active.startedAt
    if (elapsed > 0) {
      live.totalMs += elapsed
      live.sessionCount += 1
      live.byDomain[active.domain] =
        (live.byDomain[active.domain] ?? 0) + elapsed
    }
  }
  return live
}

/**
 * Tracked ms per local hour (0–23) for today, from persisted sessions + buffer
 * + the in-progress session. Powers the activity sparklines.
 */
async function getTodayHourly(): Promise<number[]> {
  const buckets = new Array(24).fill(0)
  const today = dateKey(Date.now())

  const addSpan = (startedAt: number, endedAt: number) => {
    if (dateKey(startedAt) !== today) return
    // Attribute the whole span to its start hour — good enough for a sparkline.
    const hour = new Date(startedAt).getHours()
    buckets[hour] += endedAt - startedAt
  }

  const [sessions, buffer, active] = await Promise.all([
    getSessions(),
    getBuffer(),
    getActiveSession(),
  ])
  for (const s of sessions) addSpan(s.startedAt, s.endedAt)
  for (const s of buffer) addSpan(s.startedAt, s.endedAt)
  if (active) {
    const now = Date.now()
    const end =
      now - active.lastSeenAt > ACTIVE_GAP_MAX_MS ? active.lastSeenAt : now
    addSpan(active.startedAt, end)
  }

  return buckets
}

async function handleMessage<M extends Message>(
  message: M,
): Promise<ResponseMap[M['type']]> {
  switch (message.type) {
    case 'GET_TODAY':
      // Resume tracking the focused tab if the worker restarted idle-less.
      await ensureActiveSession()
      return (await getTodayLive()) as ResponseMap[M['type']]

    case 'GET_TODAY_HOURLY':
      return (await getTodayHourly()) as ResponseMap[M['type']]

    case 'GET_DAILY_RANGE': {
      const totals = await getDailyTotals()
      const range = Object.values(totals)
        .filter((d) => d.date >= message.startDate && d.date <= message.endDate)
        .sort((a, b) => a.date.localeCompare(b.date))
      return range as ResponseMap[M['type']]
    }

    case 'GET_RECENT_SESSIONS': {
      const sessions = await getSessions()
      const recent = sessions
        .slice()
        .sort((a, b) => b.endedAt - a.endedAt)
        .slice(0, message.limit)
      return recent as ResponseMap[M['type']]
    }

    case 'GET_SETTINGS':
      return (await getSettings()) as ResponseMap[M['type']]

    case 'UPDATE_SETTINGS': {
      const next = await setSettings(message.patch)
      if (message.patch.idleThresholdSec !== undefined) {
        await applyIdleThreshold()
      }
      return next as ResponseMap[M['type']]
    }

    case 'GET_STATUS': {
      const settings = await getSettings()
      const active = await getActiveSession()
      return {
        trackingEnabled: settings.trackingEnabled,
        isTracking: !!active,
        currentDomain: active?.domain ?? null,
      } as ResponseMap[M['type']]
    }

    case 'SET_TRACKING': {
      await setSettings({ trackingEnabled: message.enabled })
      if (!message.enabled) {
        await endActiveSession()
      } else {
        await switchToActiveTab()
      }
      const active = await getActiveSession()
      return {
        trackingEnabled: message.enabled,
        isTracking: !!active,
        currentDomain: active?.domain ?? null,
      } as ResponseMap[M['type']]
    }

    case 'EXCLUDE_DOMAIN': {
      const settings = await getSettings()
      const set = new Set(settings.excludedDomains)
      set.add(message.domain)
      const next = await setSettings({ excludedDomains: [...set] })
      const active = await getActiveSession()
      if (active?.domain === message.domain) await endActiveSession()
      return next as ResponseMap[M['type']]
    }

    case 'INCLUDE_DOMAIN': {
      const settings = await getSettings()
      const next = await setSettings({
        excludedDomains: settings.excludedDomains.filter(
          (d) => d !== message.domain,
        ),
      })
      return next as ResponseMap[M['type']]
    }

    case 'EXPORT_DATA': {
      // Flush first so the export reflects everything tracked so far.
      await flushBuffer()
      const [sessions, dailyTotals, settings] = await Promise.all([
        getSessions(),
        getDailyTotals(),
        getSettings(),
      ])
      return {
        exportedAt: Date.now(),
        version: chrome.runtime.getManifest().version,
        sessions,
        dailyTotals,
        settings,
      } as ResponseMap[M['type']]
    }

    case 'RESET_DATA': {
      await resetAllData()
      return { ok: true } as ResponseMap[M['type']]
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
        console.error('[ttm] message handler failed', message.type, err)
        sendResponse(undefined)
      })
    // Return true to keep the message channel open for the async response.
    return true
  },
)
