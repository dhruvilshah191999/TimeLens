import {
  AGGREGATE_INTERVAL_MIN,
  CLEANUP_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MIN,
} from '@/lib/constants'
import { ALARM_NAMES, CONTEXT_MENU_IDS } from '@/lib/storage-keys'
import { domainFromUrl } from '@/lib/time-utils'
import { dateKey } from '@/lib/time-utils'
import type { ActiveSession, DailyTotal, Session } from '@/lib/types'
import {
  aiAvailability,
  classify,
  classifyByRules,
  classifyQuick,
  prepareAiModel,
} from './classifier'
import { applyIdleThreshold } from './idle-handler'
import type { Message, ResponseMap, StatusResponse } from './messages'
import {
  cleanupOldSessions,
  flushBuffer,
  getActiveSession,
  getAiProgress,
  getBuffer,
  getDailyTotals,
  getSessions,
  getSettings,
  needsIntentBackfill,
  reclassifyAll,
  resetAllData,
  setAiProgress,
  setSettings,
} from './storage'
import {
  activeElapsedMs,
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

  // One-time: classify sessions recorded before Phase 2 shipped (instant
  // ruleset) so the dashboard shows real intent data immediately.
  if (await needsIntentBackfill()) {
    await reclassifyAll((s) => classifyByRules(s), true)
  }

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

  // Fold in the elapsed time of the active session (capped so paused/slept
  // time is never counted).
  const active = await getActiveSession()
  if (active && dateKey(active.startedAt) === today) {
    const elapsed = activeElapsedMs(active)
    if (elapsed > 0) {
      live.totalMs += elapsed
      live.sessionCount += 1
      live.byDomain[active.domain] =
        (live.byDomain[active.domain] ?? 0) + elapsed
      // Reflect the in-progress page in the intent breakdown too (rules or a
      // cached AI answer — never prompts the model on this hot path).
      const { classificationEnabled } = await getSettings()
      const { intent } = await classifyQuick(active, classificationEnabled)
      live.byIntent[intent] = (live.byIntent[intent] ?? 0) + elapsed
    }
  }
  return live
}

/** The in-progress session as a Session-shaped record (not persisted). */
async function liveSession(active: ActiveSession): Promise<Session | null> {
  const durationMs = activeElapsedMs(active)
  if (durationMs <= 0) return null
  const { classificationEnabled } = await getSettings()
  const r = await classifyQuick(active, classificationEnabled)
  return {
    id: 'live',
    domain: active.domain,
    url: active.url,
    title: active.title,
    startedAt: active.startedAt,
    endedAt: active.startedAt + durationMs,
    durationMs,
    intent: r.intent,
    intentConfidence: r.confidence,
    intentSource: r.source,
  }
}

/** Persisted + buffered + live sessions that started within a date range. */
async function getSessionsRange(
  startDate: string,
  endDate: string,
): Promise<Session[]> {
  const [sessions, buffer, active] = await Promise.all([
    getSessions(),
    getBuffer(),
    getActiveSession(),
  ])
  const all = [...sessions, ...buffer]
  const live = active ? await liveSession(active) : null
  if (live) all.push(live)
  return all
    .filter((s) => {
      const d = dateKey(s.startedAt)
      return d >= startDate && d <= endDate
    })
    .sort((a, b) => a.startedAt - b.startedAt)
}

async function buildStatus(): Promise<StatusResponse> {
  const settings = await getSettings()
  const active = await getActiveSession()
  const r = active
    ? await classifyQuick(active, settings.classificationEnabled)
    : null
  return {
    trackingEnabled: settings.trackingEnabled,
    isTracking: !!active,
    currentDomain: active?.domain ?? null,
    currentUrl: active?.url ?? null,
    currentTitle: active?.title ?? null,
    currentIntent: r?.intent ?? null,
    currentIntentSource: r?.source ?? null,
    sessionElapsedMs: active ? activeElapsedMs(active) : null,
  }
}

async function handleMessage<M extends Message>(
  message: M,
): Promise<ResponseMap[M['type']]> {
  switch (message.type) {
    case 'GET_TODAY':
      // Resume tracking the focused tab if the worker restarted idle-less.
      await ensureActiveSession()
      return (await getTodayLive()) as ResponseMap[M['type']]

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

    case 'GET_SESSIONS_RANGE':
      return (await getSessionsRange(
        message.startDate,
        message.endDate,
      )) as ResponseMap[M['type']]

    case 'GET_SETTINGS':
      return (await getSettings()) as ResponseMap[M['type']]

    case 'UPDATE_SETTINGS': {
      const next = await setSettings(message.patch)
      if (message.patch.idleThresholdSec !== undefined) {
        await applyIdleThreshold()
      }
      // Turning smart classification ON proactively warms up / downloads the
      // on-device model (if the Prompt API is present), streaming progress to
      // session storage for the Settings UI to poll. Fire-and-forget so the
      // settings save returns immediately.
      if (message.patch.classificationEnabled === true) {
        void prepareAiModel((p) => {
          void setAiProgress(p)
        })
      }
      return next as ResponseMap[M['type']]
    }

    case 'GET_STATUS': {
      await ensureActiveSession()
      return (await buildStatus()) as ResponseMap[M['type']]
    }

    case 'SET_TRACKING': {
      await setSettings({ trackingEnabled: message.enabled })
      if (!message.enabled) {
        await endActiveSession()
      } else {
        await switchToActiveTab()
      }
      return (await buildStatus()) as ResponseMap[M['type']]
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

    case 'GET_AI_STATUS': {
      const [availability, settings, download] = await Promise.all([
        aiAvailability(),
        getSettings(),
        getAiProgress(),
      ])
      return {
        availability,
        enabled: settings.classificationEnabled,
        download: download ?? { state: 'idle', progress: 0 },
      } as ResponseMap[M['type']]
    }

    case 'RECLASSIFY_ALL': {
      // Flush so just-ended sessions are included, then re-run every session
      // through the active engine (AI tier included when the user enabled it).
      await flushBuffer()
      const { classificationEnabled } = await getSettings()
      const count = await reclassifyAll(
        (s) =>
          classify(
            { domain: s.domain, url: s.url, title: s.title },
            classificationEnabled,
          ),
        false,
      )
      return { ok: true, count } as ResponseMap[M['type']]
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
