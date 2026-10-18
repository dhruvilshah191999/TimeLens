import { sendMessage } from '@/background/messages'
import { IntentSwatch, SplitBar } from '@/components/IntentViz'
import { DEFAULT_CATEGORIES, categoryFor } from '@/lib/constants'
import { focusShare, formatDelta, formatHM, siteSplits } from '@/lib/insights'
import { dateKey } from '@/lib/time-utils'
import type { DailyTotal } from '@/lib/types'
import { useAsync } from '@/lib/use-async'
import { cn } from '@/lib/utils'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import { useState } from 'react'
import { Empty, Panel } from '../components/Panel'

const RANGES = [7, 30]
const HOUR = 60 * 60 * 1000

function sumIntents(days: DailyTotal[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of days) {
    for (const [id, ms] of Object.entries(d.byIntent)) {
      out[id] = (out[id] ?? 0) + ms
    }
  }
  return out
}

export function Trends() {
  const [days, setDays] = useState(7)
  const end = new Date()
  const start = subDays(end, days - 1)
  const prevEnd = subDays(start, 1)
  const prevStart = subDays(prevEnd, days - 1)
  const startKey = dateKey(start)
  const endKey = dateKey(end)

  const range = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: startKey,
        endDate: endKey,
      }),
    [days],
    10000,
  )
  const prev = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: dateKey(prevStart),
        endDate: dateKey(prevEnd),
      }),
    [days],
    60000,
  )
  // Today's persisted total lags the live one; prefer the live value.
  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 10000)
  const sessions = useAsync(
    () =>
      sendMessage({
        type: 'GET_SESSIONS_RANGE',
        startDate: startKey,
        endDate: endKey,
      }),
    [days],
    15000,
  )

  const byDate = new Map((range.data ?? []).map((d) => [d.date, d]))
  if (today.data) byDate.set(today.data.date, today.data)
  const current = [...byDate.values()]

  const series = eachDayOfInterval({ start, end }).map((date) => {
    const d = byDate.get(dateKey(date))
    return {
      key: dateKey(date),
      label: format(date, days > 7 ? 'd' : 'EEE'),
      title: format(date, 'EEE d MMM'),
      totalMs: d?.totalMs ?? 0,
      byIntent: d?.byIntent ?? {},
    }
  })

  const total = current.reduce((a, d) => a + d.totalMs, 0)
  const prevTotal = (prev.data ?? []).reduce((a, d) => a + d.totalMs, 0)
  const nowIntents = sumIntents(current)
  const prevIntents = sumIntents(prev.data ?? [])
  const focus = focusShare(nowIntents)

  const shift = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    now: nowIntents[c.id] ?? 0,
    prev: prevIntents[c.id] ?? 0,
  })).filter((r) => r.now > 0 || r.prev > 0)
  const biggest = [...shift].sort(
    (a, b) => Math.abs(b.now - b.prev) - Math.abs(a.now - a.prev),
  )[0]

  // Y axis: three equal steps of whole hours above the busiest day.
  const maxDay = Math.max(...series.map((d) => d.totalMs), 0)
  const step = Math.max(1, Math.ceil(maxDay / HOUR / 3))
  const top = step * 3 * HOUR

  const sites = siteSplits(sessions.data ?? []).slice(0, 6)
  const maxSite = sites[0]?.totalMs ?? 1
  const periodWord = days === 7 ? 'week' : `${days} days`

  const stats = [
    {
      label: 'Tracked',
      value: formatHM(total),
      sub:
        prevTotal > 0
          ? `${formatDelta(total - prevTotal)} vs previous ${periodWord}`
          : `last ${days} days`,
    },
    {
      label: 'Daily average',
      value: formatHM(Math.round(total / days)),
      sub: `across ${days} days`,
    },
    {
      label: 'Focused',
      value: focus === null ? '—' : `${focus}%`,
      sub: 'Work and Learning',
    },
    {
      label: 'Biggest shift',
      value: biggest ? biggest.label : '—',
      sub: biggest
        ? `${formatDelta(biggest.now - biggest.prev)} vs previous ${periodWord}`
        : 'not enough history',
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-muted-foreground">
            {format(start, 'd MMM')} – {format(end, 'd MMM')}
          </p>
          <h1 className="text-[34px] font-bold tracking-[-0.02em]">Trends</h1>
        </div>
        <fieldset className="m-0 flex gap-1 rounded-xl border bg-card p-1">
          <legend className="sr-only">Range</legend>
          {RANGES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={cn(
                'min-h-10 rounded-lg px-4 text-[13px] font-semibold transition-colors',
                days === n
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Last {n} days
            </button>
          ))}
        </fieldset>
      </header>

      {/* Stat strip */}
      <section
        aria-label="Summary"
        className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] rounded-[14px] border bg-card"
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1.5 border-r border-border/60 px-6 py-5 last:border-r-0"
          >
            <span className="text-[13px] text-muted-foreground">{s.label}</span>
            <span className="font-figure text-[26px] font-medium tracking-[-0.03em]">
              {s.value}
            </span>
            <span className="text-xs text-muted-foreground">{s.sub}</span>
          </div>
        ))}
      </section>

      {/* Stacked daily bars */}
      <Panel
        id="daily-h"
        title="Each day, by intent"
        aside={
          <div className="flex flex-wrap gap-3.5">
            {DEFAULT_CATEGORIES.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5 text-xs">
                <IntentSwatch intent={c.id} />
                {c.label}
              </span>
            ))}
          </div>
        }
      >
        {total === 0 ? (
          <Empty>No time tracked in this range yet.</Empty>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
              <div className="font-figure flex h-[260px] flex-col justify-between text-right text-[11px] text-muted-foreground">
                {[3, 2, 1, 0].map((i) => (
                  <span key={i}>{i === 0 ? '0' : `${step * i}h`}</span>
                ))}
              </div>
              <div
                className={cn(
                  'grid h-[260px] items-end border-b',
                  days > 7 ? 'gap-1' : 'gap-4',
                )}
                style={{
                  gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
                  background:
                    'linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px) 0 0 / 100% 33.333%',
                }}
              >
                {series.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.title} · ${formatHM(d.totalMs)}`}
                    className="flex w-full max-w-[72px] flex-col-reverse gap-0.5 justify-self-center"
                    style={{ height: `${(d.totalMs / top) * 100}%` }}
                  >
                    {DEFAULT_CATEGORIES.filter((c) => d.byIntent[c.id]).map(
                      (c) => (
                        <div
                          key={c.id}
                          className="rounded-[3px]"
                          style={{
                            flex: `${d.byIntent[c.id]} 1 0`,
                            backgroundColor: c.color,
                          }}
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
              <span />
              <div
                className={cn('grid', days > 7 ? 'gap-1' : 'gap-4')}
                style={{
                  gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
                }}
              >
                {series.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <span className="text-xs font-semibold">{d.label}</span>
                    {days === 7 && (
                      <span className="font-figure text-[11px] text-muted-foreground">
                        {formatHM(d.totalMs)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-5">
        <Panel id="shift-h" title={`Compared with previous ${periodWord}`}>
          {shift.length === 0 ? (
            <Empty>Not enough history to compare yet.</Empty>
          ) : (
            <div className="flex flex-col">
              <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_72px] gap-3 border-b border-border/60 pb-1.5 text-xs text-muted-foreground">
                <span>Intent</span>
                <span className="text-right">
                  This {days === 7 ? 'week' : 'period'}
                </span>
                <span className="text-right">Previous</span>
                <span className="text-right">Change</span>
              </div>
              {shift.map((r) => (
                <div
                  key={r.id}
                  className="grid min-h-9 grid-cols-[minmax(0,1fr)_80px_80px_72px] items-center gap-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <IntentSwatch intent={r.id} />
                    {r.label}
                  </span>
                  <span className="font-figure text-right text-[13px]">
                    {formatHM(r.now)}
                  </span>
                  <span className="font-figure text-right text-[13px] text-muted-foreground">
                    {formatHM(r.prev)}
                  </span>
                  <span
                    className={cn(
                      'font-figure text-right text-[13px]',
                      r.now < r.prev && 'text-muted-foreground',
                    )}
                  >
                    {formatDelta(r.now - r.prev)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          id="wsites-h"
          title={`Top sites this ${days === 7 ? 'week' : 'period'}`}
        >
          {sites.length === 0 ? (
            <Empty>No sites in this range yet.</Empty>
          ) : (
            <div className="flex flex-col gap-1">
              {sites.map((s) => (
                <div
                  key={s.domain}
                  className="grid min-h-9 grid-cols-[minmax(0,160px)_minmax(0,1fr)_64px] items-center gap-3"
                >
                  <span className="truncate text-sm" title={s.domain}>
                    {s.domain}
                  </span>
                  <SplitBar
                    parts={s.parts}
                    widthPct={(s.totalMs / maxSite) * 100}
                    className="h-2.5"
                  />
                  <span
                    className="font-figure text-right text-[13px]"
                    title={s.parts
                      .map(
                        (p) =>
                          `${categoryFor(p.intent).label} ${formatHM(p.ms)}`,
                      )
                      .join(' · ')}
                  >
                    {formatHM(s.totalMs)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
