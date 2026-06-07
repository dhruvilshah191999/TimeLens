import { Area, AreaChart, ResponsiveContainer } from 'recharts'

/** Minimal axis-less area sparkline. `data` is a series of numbers. */
export function Sparkline({
  data,
  color = 'hsl(var(--primary))',
  className,
}: {
  data: number[]
  color?: string
  className?: string
}) {
  const points = data.map((v, i) => ({ i, v }))
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 2, bottom: 2, left: 0, right: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
