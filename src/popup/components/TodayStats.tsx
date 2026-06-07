import { Sparkline } from '@/components/Sparkline'
import { formatDurationLong } from '@/lib/time-utils'

export function TodayStats({
  totalMs,
  hourly,
}: {
  totalMs: number
  hourly: number[]
}) {
  const hasActivity = hourly.some((v) => v > 0)
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Today
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          {/* Seconds-inclusive so the in-progress session ticks up live. */}
          <p className="text-3xl font-bold tabular-nums leading-none">
            {formatDurationLong(totalMs)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">active time</p>
        </div>
        {hasActivity && (
          <Sparkline data={hourly} className="h-10 w-24 shrink-0" />
        )}
      </div>
    </div>
  )
}
