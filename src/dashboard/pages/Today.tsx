import { sendMessage } from '@/background/messages'
import { IntentBadge } from '@/components/IntentBadge'
import {
  DayRibbon,
  IntentBar,
  IntentSwatch,
  SplitBar,
} from '@/components/IntentViz'
import { SiteIcon } from '@/components/SiteIcon'
import { ThemeToggle } from '@/components/ThemeToggle'
import { categoryFor } from '@/lib/constants'
import {
  dayRhythm,
  focusShare,
  formatDelta,
  formatHM,
  groupByDay,
  intentSegments,
  siteSplits,
} from '@/lib/insights'
import { dateKey, formatClock } from '@/lib/time-utils'
import { useAsync } from '@/lib/use-async'
import { format, startOfDay, subDays } from 'date-fns'
import { Empty, Fig, Panel } from '../components/Panel'

const TOP_SITES = 8

export function Today() {
  const todayKey = dateKey(Date.now())
  const yesterdayDate = subDays(new Date(), 1)
  const yesterdayKey = dateKey(yesterdayDate)

  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 3000)
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
  const recent = useAsync(
    () => sendMessage({ type: 'GET_RECENT_SESSIONS', limit: 12 }),
    [],
    5000,
  )
  const yesterday = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: yesterdayKey,
        endDate: yesterdayKey,
      }),
    [yesterdayKey],
    60000,
  )

  const totalMs = today.data?.totalMs ?? 0
  const byIntent = today.data?.byIntent ?? {}
  const focus = focusShare(byIntent)
  const yTotal = yesterday.data?.[0]?.totalMs ?? 0
  const todaySessions = sessions.data ?? []
  const sites = siteSplits(todaySessions)
  const maxSite = sites[0]?.totalMs ?? 1
  const rhythm = dayRhythm(todaySessions)

  // The biggest site counted under more than one intent, for the headline.
  const splitSite = sites.find((s) => s.parts.length > 1)

  async function setTracking(enabled: boolean) {
    await sendMessage({ type: 'SET_TRACKING', enabled })
    status.reload()
  }

  const st = status.data
  const trackingEnabled = st?.trackingEnabled ?? true

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-7">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-muted-foreground">
            {format(new Date(), 'EEEE, d MMMM')}
          </p>
          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="font-figure text-[56px] font-medium leading-none tracking-[-0.04em]">
              {formatHM(totalMs)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {yTotal > 0 && (
                <>
                  <Fig>{formatDelta(totalMs - yTotal)}</Fig> vs{' '}
                  {format(yesterdayDate, 'EEEE')}
                </>
              )}
              {yTotal > 0 && focus !== null && ' · '}
              {focus !== null && (
                <>
                  <Fig>{focus}%</Fig> focused
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {st?.currentDomain && st.sessionElapsedMs != null ? (
            <div className="flex min-h-11 items-center gap-2.5 rounded-[10px] border bg-card px-3.5">
              <span className="size-2 rounded-full bg-success" />
              <span className="text-[13px] text-muted-foreground">Now</span>
              <span className="max-w-[220px] truncate text-[13px] font-semibold">
                {st.currentDomain}
              </span>
              <IntentBadge intent={st.currentIntent ?? undefined} />
              <span className="font-figure text-[13px]">
                {formatClock(st.sessionElapsedMs)}
              </span>
            </div>
          ) : (
            <div className="flex min-h-11 items-center gap-2.5 rounded-[10px] border bg-card px-3.5 text-[13px] text-muted-foreground">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              {trackingEnabled ? 'Not on a tracked page' : 'Tracking paused'}
            </div>
          )}
          <button
            type="button"
            onClick={() => setTracking(!trackingEnabled)}
            className="min-h-11 rounded-[10px] border border-primary bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {trackingEnabled ? 'Pause tracking' : 'Resume tracking'}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Intent split */}
      <Panel
        id="split-h"
        title="By intent"
        aside={
          splitSite && (
            <>
              Same site, different reasons: {splitSite.domain} counted as{' '}
              {splitSite.parts.map((p, i) => (
                <span key={p.intent}>
                  {i > 0 && (i === splitSite.parts.length - 1 ? ' and ' : ', ')}
                  {categoryFor(p.intent).label} <Fig>{formatHM(p.ms)}</Fig>
                </span>
              ))}
            </>
          )
        }
      >
        {totalMs === 0 ? (
          <Empty>
            Nothing tracked yet today. Browse a little and it fills in.
          </Empty>
        ) : (
          <>
            <IntentBar byIntent={byIntent} className="h-5" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {intentSegments(byIntent).map((s) => (
                <div key={s.id} className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-[13px] font-medium">
                    <IntentSwatch intent={s.id} />
                    {s.label}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-figure text-xl font-medium tracking-[-0.02em]">
                      {formatHM(s.ms)}
                    </span>
                    <span className="font-figure text-xs text-muted-foreground">
                      {s.pct}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* Day ribbon */}
      <Panel
        id="day-h"
        title="Your day"
        aside={
          rhythm && (
            <>
              Busiest stretch <Fig>{rhythm.busiest}</Fig> · first activity{' '}
              <Fig>{rhythm.first}</Fig>
            </>
          )
        }
      >
        <DayRibbon
          sessions={todaySessions}
          dayStart={startOfDay(new Date()).getTime()}
          showNow
        />
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-5">
        {/* Where it went */}
        <Panel
          id="sites-h"
          title="Where it went"
          flush
          aside={sites.length > 0 && `${sites.length} sites`}
        >
          {sites.length === 0 ? (
            <Empty>No sites yet today.</Empty>
          ) : (
            sites.slice(0, TOP_SITES).map((s) => (
              <div
                key={s.domain}
                className="grid grid-cols-[28px_minmax(0,1fr)_64px] items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-hover"
              >
                <SiteIcon domain={s.domain} url={s.url} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="truncate text-sm font-medium"
                      title={s.domain}
                    >
                      {s.domain}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {s.parts.length > 1
                        ? `${s.parts.length} intents`
                        : categoryFor(s.parts[0]?.intent).label}
                    </span>
                  </div>
                  <SplitBar
                    parts={s.parts}
                    widthPct={(s.totalMs / maxSite) * 100}
                    className="h-1.5"
                  />
                </div>
                <span className="font-figure text-right text-[13px]">
                  {formatHM(s.totalMs)}
                </span>
              </div>
            ))
          )}
        </Panel>

        {/* Sessions */}
        <Panel id="sess-h" title="Sessions" flush>
          {!recent.data || recent.data.length === 0 ? (
            <Empty>No sessions recorded yet.</Empty>
          ) : (
            groupByDay(recent.data).map((g) => (
              <div key={g.day} className="flex flex-col">
                <p className="eyebrow px-3 pb-1.5 pt-3">{g.day}</p>
                {g.items.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[112px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-hover"
                  >
                    <span className="font-figure whitespace-nowrap text-xs text-muted-foreground">
                      {format(s.startedAt, 'HH:mm')}–
                      {format(s.endedAt, 'HH:mm')}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className="truncate text-sm font-medium"
                        title={s.title}
                      >
                        {s.title}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <IntentSwatch
                          intent={s.intent}
                          className="size-2 rounded-sm"
                        />
                        <span className="truncate">
                          {categoryFor(s.intent).label} · {s.domain}
                        </span>
                      </span>
                    </div>
                    <span className="font-figure text-[13px]">
                      {formatHM(s.durationMs)}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}
