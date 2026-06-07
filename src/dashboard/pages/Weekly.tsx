import { sendMessage } from '@/background/messages'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CHART_COLORS } from '@/lib/constants'
import {
  dateKey,
  formatDuration,
  formatDurationLong,
  topNWithOther,
} from '@/lib/time-utils'
import type { DailyTotal } from '@/lib/types'
import { useAsync } from '@/lib/use-async'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const DAYS = 7

export function Weekly() {
  const end = new Date()
  const start = subDays(end, DAYS - 1)
  const range = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: dateKey(start),
        endDate: dateKey(end),
      }),
    [],
    10000,
  )

  const byDate = new Map<string, DailyTotal>()
  for (const d of range.data ?? []) byDate.set(d.date, d)

  // One row per day so the line chart shows zero-days too.
  const days = eachDayOfInterval({ start, end }).map((date) => {
    const key = dateKey(date)
    const total = byDate.get(key)
    return {
      key,
      label: format(date, 'EEE'),
      minutes: Math.round((total?.totalMs ?? 0) / 60000),
      totalMs: total?.totalMs ?? 0,
    }
  })

  // Aggregate domains across the week.
  const weekDomains: Record<string, number> = {}
  for (const d of range.data ?? []) {
    for (const [domain, ms] of Object.entries(d.byDomain)) {
      weekDomains[domain] = (weekDomains[domain] ?? 0) + ms
    }
  }
  const domainData = topNWithOther(weekDomains, 8).map(([name, value], i) => ({
    name,
    minutes: Math.round(value / 60000),
    value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const weekTotal = days.reduce((sum, d) => sum + d.totalMs, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Weekly</h1>
        <p className="mt-1 text-muted-foreground">
          Last {DAYS} days · {formatDuration(weekTotal)} total
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily trend</CardTitle>
          <CardDescription>Minutes tracked per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={days} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(_v, _n, item) => [
                    formatDurationLong(
                      (item?.payload as { totalMs: number }).totalMs,
                    ),
                    'Tracked',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top sites this week</CardTitle>
          <CardDescription>
            Total time per site across {DAYS} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domainData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No data for this period yet.
            </p>
          ) : (
            <div style={{ height: domainData.length * 44 + 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={domainData}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 12 }}
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
                    formatter={(_v, _n, item) => [
                      formatDurationLong(
                        (item?.payload as { value: number }).value,
                      ),
                      'Time',
                    ]}
                  />
                  <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                    {domainData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
