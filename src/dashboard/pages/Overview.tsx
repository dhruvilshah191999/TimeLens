import { sendMessage } from '@/background/messages'
import { Icon } from '@/components/Icon'
import { SiteIcon } from '@/components/SiteIcon'
import { Sparkline } from '@/components/Sparkline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  dateKey,
  formatDuration,
  formatDurationLong,
  sortedEntries,
  topNWithOther,
} from '@/lib/time-utils'
import { useAsync } from '@/lib/use-async'
import { cn } from '@/lib/utils'
import { format, subDays } from 'date-fns'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { IntentPreview } from '../components/IntentPreview'
import { StatCard } from '../components/StatCard'

function Delta({ value, unit }: { value: number | null; unit: string }) {
  if (value === null || value === 0) {
    return <span className="text-muted-foreground">{unit}</span>
  }
  const up = value > 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        up ? 'text-success' : 'text-destructive',
      )}
    >
      <Icon name={up ? 'arrow-upward' : 'arrow-downward'} className="text-xs" />
      {Math.abs(value)}
      {unit}
    </span>
  )
}

export function Overview() {
  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 3000)
  const hourly = useAsync(
    () => sendMessage({ type: 'GET_TODAY_HOURLY' }),
    [],
    5000,
  )
  const recent = useAsync(
    () => sendMessage({ type: 'GET_RECENT_SESSIONS', limit: 8 }),
    [],
    3000,
  )
  const yesterdayKey = dateKey(subDays(new Date(), 1))
  const yesterday = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: yesterdayKey,
        endDate: yesterdayKey,
      }),
    [],
    30000,
  )

  const [topN, setTopN] = useState(8)

  const totalMs = today.data?.totalMs ?? 0
  const byDomain = today.data?.byDomain ?? {}
  const sessionCount = today.data?.sessionCount ?? 0
  const sorted = sortedEntries(byDomain)
  const [topDomain, topDomainMs] = sorted[0] ?? ['—', 0]

  const yTotal = yesterday.data?.[0]?.totalMs ?? 0
  const ySessions = yesterday.data?.[0]?.sessionCount ?? 0
  const totalDeltaPct =
    yTotal > 0 ? Math.round(((totalMs - yTotal) / yTotal) * 100) : null
  const sessionDelta = ySessions > 0 ? sessionCount - ySessions : null

  const chartData = topNWithOther(byDomain, topN).map(([name, value], i) => ({
    name,
    value,
    label: formatDuration(value),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          {format(new Date(), 'EEEE, MMMM d')} · {formatDuration(totalMs)}{' '}
          tracked today
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="alarm-1"
          tint="#6366f1"
          label="Total time today"
          value={formatDuration(totalMs)}
          footer={<Delta value={totalDeltaPct} unit="% vs yesterday" />}
        />
        <StatCard
          icon="star-fat"
          tint="#ec4899"
          label="Most used site"
          value={<span className="truncate">{topDomain}</span>}
          footer={
            totalMs > 0
              ? `${formatDuration(topDomainMs)} · ${Math.round(
                  (topDomainMs / totalMs) * 100,
                )}%`
              : '—'
          }
        />
        <StatCard
          icon="layers-1"
          tint="#8b5cf6"
          label="Sessions"
          value={sessionCount}
          footer={<Delta value={sessionDelta} unit=" vs yesterday" />}
        />
        <StatCard
          icon="bolt-2"
          tint="#22c55e"
          label="Focus ratio"
          value={<span className="text-muted-foreground">—</span>}
          footer="Learning + Work · Phase 2"
        />
      </div>

      {/* Time by site + Recent sessions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Time by site today</CardTitle>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value={5}>Top 5</option>
              <option value={8}>Top 8</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
            </select>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nothing tracked yet today.
              </p>
            ) : (
              <div style={{ height: chartData.length * 40 + 16 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 56 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{
                        fontSize: 12,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(value) => [
                        formatDurationLong(value as number),
                        'Time',
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                      <LabelList
                        dataKey="label"
                        position="right"
                        className="fill-muted-foreground"
                        style={{ fontSize: 11 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {!recent.data || recent.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sessions recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {recent.data.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <SiteIcon domain={s.domain} url={s.url} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        title={s.domain}
                      >
                        {s.domain}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={s.title}
                      >
                        {s.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatDuration(s.durationMs)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                      {format(s.endedAt, 'HH:mm')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Intent preview + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IntentPreview />
        </div>
        <ActivityCard hourly={hourly.data ?? []} />
      </div>
    </div>
  )
}

function ActivityCard({ hourly }: { hourly: number[] }) {
  const hasData = hourly.some((v) => v > 0)
  let peakHour = -1
  let peak = 0
  hourly.forEach((v, h) => {
    if (v > peak) {
      peak = v
      peakHour = h
    }
  })
  const peakLabel =
    peakHour >= 0 ? format(new Date(2000, 0, 1, peakHour), 'h a') : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity today</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData && peakLabel ? (
          <p className="text-sm text-muted-foreground">
            You were most active around{' '}
            <span className="font-semibold text-foreground">{peakLabel}</span>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No activity recorded yet today.
          </p>
        )}
        <Sparkline data={hourly} className="mt-4 h-24 w-full" />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>12 AM</span>
          <span>12 PM</span>
          <span>11 PM</span>
        </div>
      </CardContent>
    </Card>
  )
}
