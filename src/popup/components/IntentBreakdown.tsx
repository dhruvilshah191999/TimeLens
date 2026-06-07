import { CHART_COLORS } from '@/lib/constants'
import { formatDuration, topNWithOther } from '@/lib/time-utils'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

/**
 * Donut of the top sites by time today, with a centered count and a legend.
 * In Phase 2 this gains an intent-breakdown mode; for now it shows domains.
 */
export function IntentBreakdown({
  byDomain,
}: {
  byDomain: Record<string, number>
}) {
  const entries = topNWithOther(byDomain, 5)
  const data = entries.map(([name, value], i) => ({
    name,
    value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))
  // Count distinct real sites (exclude the synthetic "Other" bucket).
  const siteCount = Object.keys(byDomain).length

  return (
    <div className="rounded-xl border bg-secondary/40 p-4">
      <p className="mb-3 text-sm font-semibold">Top sites today</p>
      <div className="flex items-center gap-4">
        <div className="relative size-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={58}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold leading-none">{siteCount}</span>
            <span className="text-[11px] text-muted-foreground">
              {siteCount === 1 ? 'Site' : 'Sites'}
            </span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((d) => (
            <li key={d.name} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="min-w-0 flex-1 truncate" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatDuration(d.value)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
