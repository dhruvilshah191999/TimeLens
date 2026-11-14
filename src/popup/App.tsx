import { sendMessage } from '@/background/messages'
import {
  DayRibbon,
  IntentBar,
  IntentSwatch,
  SplitBar,
} from '@/components/IntentViz'
import { LensMark } from '@/components/LensMark'
import { SiteIcon } from '@/components/SiteIcon'
import { ArrowRightIcon } from '@/components/icons'
import { Switch } from '@/components/ui/switch'
import { categoryFor } from '@/lib/constants'
import {
  focusShare,
  formatHM,
  intentSegments,
  siteSplits,
} from '@/lib/insights'
import { dateKey, formatClock } from '@/lib/time-utils'
import { useAsync } from '@/lib/use-async'
import { startOfDay } from 'date-fns'

export function App() {
  const todayKey = dateKey(Date.now())
  // Tick every second while the popup is open (live total + session timer).
  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 1000)
  const status = useAsync(() => sendMessage({ type: 'GET_STATUS' }), [], 1000)
  const sessions = useAsync(
    () =>
      sendMessage({
        type: 'GET_SESSIONS_RANGE',
        startDate: todayKey,
        endDate: todayKey,
      }),
    [todayKey],
    5000,
  )

  async function toggleTracking(enabled: boolean) {
    await sendMessage({ type: 'SET_TRACKING', enabled })
    status.reload()
    today.reload()
  }

  const st = status.data
  const trackingEnabled = st?.trackingEnabled ?? true
  const totalMs = today.data?.totalMs ?? 0
  const byIntent = today.data?.byIntent ?? {}
  const focus = focusShare(byIntent)
  const todaySessions = sessions.data ?? []
  const sites = siteSplits(todaySessions).slice(0, 4)
  const maxSite = sites[0]?.totalMs ?? 1
  const topIntents = intentSegments(byIntent)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 4)

  return (
    <div className="flex w-[360px] flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-1.5">
        <div className="flex items-center gap-2">
          <LensMark className="size-[22px]" />
          <span className="text-[15px] font-bold">TimeLens</span>
        </div>
        <div className="flex min-h-11 items-center gap-2">
          <span id="trk-label" className="text-xs text-muted-foreground">
            {trackingEnabled ? 'Tracking' : 'Paused'}
          </span>
          <Switch
            checked={trackingEnabled}
            onCheckedChange={toggleTracking}
            aria-labelledby="trk-label"
            className="data-[state=checked]:bg-success"
          />
        </div>
      </header>

      {/* Now */}
      <div className="mx-4 mt-3.5 flex items-center gap-2.5 rounded-[10px] border bg-card p-3">
        {st?.currentDomain && st.sessionElapsedMs != null ? (
          <>
            <SiteIcon
              domain={st.currentDomain}
              url={st.currentUrl ?? undefined}
              className="size-6"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-semibold">
                {st.currentDomain}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IntentSwatch
                  intent={st.currentIntent ?? undefined}
                  className="size-2 rounded-sm"
                />
                {categoryFor(st.currentIntent ?? undefined).label} ·{' '}
                {st.currentIntentSource === 'ai'
                  ? 'Gemini Nano'
                  : 'keyword rule'}
              </span>
            </div>
            <span className="font-figure text-[15px]">
              {formatClock(st.sessionElapsedMs)}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            {trackingEnabled ? 'Not on a tracked page' : 'Tracking is paused'}
          </span>
        )}
      </div>

      {/* Today */}
      <section aria-label="Today" className="flex flex-col gap-3 px-4 pt-5">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span className="font-medium">Today</span>
          {focus !== null && (
            <span>
              <span className="font-figure text-foreground">{focus}%</span>{' '}
              focused
            </span>
          )}
        </div>
        <p className="font-figure text-[40px] font-medium leading-none tracking-[-0.04em]">
          {formatHM(totalMs)}
        </p>
        <IntentBar byIntent={byIntent} className="h-2.5" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {topIntents.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <IntentSwatch intent={s.id} className="size-2 rounded-sm" />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="font-figure text-muted-foreground">
                {formatHM(s.ms)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1">
          <DayRibbon
            sessions={todaySessions}
            dayStart={startOfDay(new Date()).getTime()}
            compact
          />
        </div>
      </section>

      {/* Top sites */}
      <section aria-label="Top sites" className="flex flex-col px-2 pt-4">
        <p className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">
          Top sites
        </p>
        {sites.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            Nothing tracked yet today.
          </p>
        ) : (
          sites.map((s) => (
            <div
              key={s.domain}
              className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 px-2 py-[7px]"
            >
              <SiteIcon
                domain={s.domain}
                url={s.url}
                className="size-6 rounded-md"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[13px]" title={s.domain}>
                  {s.domain}
                </span>
                <SplitBar
                  parts={s.parts}
                  widthPct={(s.totalMs / maxSite) * 100}
                  className="h-1"
                />
              </div>
              <span className="font-figure text-xs">{formatHM(s.totalMs)}</span>
            </div>
          ))
        )}
      </section>

      <footer className="mt-3 flex min-h-[52px] items-center justify-between border-t px-4">
        <span className="text-xs text-muted-foreground">
          Stays on this device
        </span>
        <button
          type="button"
          onClick={() => chrome.runtime.openOptionsPage()}
          className="flex min-h-11 items-center gap-1.5 text-[13px] font-semibold hover:text-muted-foreground"
        >
          Open dashboard
          <ArrowRightIcon className="size-3.5" />
        </button>
      </footer>
    </div>
  )
}
