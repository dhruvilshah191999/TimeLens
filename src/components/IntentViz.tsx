import { categoryFor } from '@/lib/constants'
import { intentSegments } from '@/lib/insights'
import type { Session } from '@/lib/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

/** Segmented bar of time by intent; segment widths are proportional. */
export function IntentBar({
  byIntent,
  className,
}: {
  byIntent: Record<string, number>
  className?: string
}) {
  const segments = intentSegments(byIntent)
  if (segments.length === 0) {
    return <div className={cn('rounded bg-track', className)} />
  }
  return (
    <div className={cn('flex gap-[3px]', className)}>
      {segments.map((s) => (
        <div
          key={s.id}
          title={`${s.label} · ${s.pct}%`}
          className="min-w-1 rounded-[4px]"
          style={{ flex: `${s.ms} 1 0`, backgroundColor: s.color }}
        />
      ))}
    </div>
  )
}

/** Thin bar of one site's time split by intent. */
export function SplitBar({
  parts,
  widthPct,
  className,
}: {
  parts: { intent: string; ms: number }[]
  widthPct: number
  className?: string
}) {
  return (
    <div
      className={cn('flex gap-0.5', className)}
      style={{ width: `${Math.max(4, widthPct)}%` }}
    >
      {parts.map((p) => (
        <div
          key={p.intent}
          title={categoryFor(p.intent).label}
          className="rounded-sm"
          style={{
            flex: `${p.ms} 1 0`,
            backgroundColor: categoryFor(p.intent).color,
          }}
        />
      ))}
    </div>
  )
}

/** Small colored square used as an intent legend marker. */
export function IntentSwatch({
  intent,
  className,
}: {
  intent: string | undefined
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('size-2.5 shrink-0 rounded-[3px]', className)}
      style={{ backgroundColor: categoryFor(intent).color }}
    />
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The day ribbon: a 24-hour track with one block per session, colored by
 * intent. `dayStart` is local midnight of the day shown.
 */
export function DayRibbon({
  sessions,
  dayStart,
  showNow = false,
  compact = false,
}: {
  sessions: Session[]
  dayStart: number
  showNow?: boolean
  compact?: boolean
}) {
  const pos = (ts: number) =>
    Math.min(100, Math.max(0, ((ts - dayStart) / DAY_MS) * 100))
  const nowPct = pos(Date.now())
  const ticks = compact
    ? ['00', '06', '12', '18', '24']
    : ['00', '03', '06', '09', '12', '15', '18', '21']

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'relative rounded-lg',
          compact ? 'h-[18px] rounded bg-track' : 'h-14',
        )}
        style={
          compact
            ? undefined
            : {
                background:
                  'repeating-linear-gradient(90deg, hsl(var(--background)) 0, hsl(var(--background)) calc(100% / 24 - 1px), hsl(var(--track)) calc(100% / 24 - 1px), hsl(var(--track)) calc(100% / 24))',
              }
        }
      >
        {sessions.map((s) => {
          const left = pos(s.startedAt)
          const width = pos(s.endedAt) - left
          return (
            <div
              key={s.id}
              title={`${format(s.startedAt, 'HH:mm')}–${format(s.endedAt, 'HH:mm')} · ${s.domain} · ${categoryFor(s.intent).label}`}
              className={cn(
                'absolute rounded-[3px]',
                compact ? 'inset-y-1 min-w-0.5' : 'inset-y-2 min-w-[3px]',
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: categoryFor(s.intent).color,
              }}
            />
          )
        })}
        {showNow && !compact && (
          <div
            aria-hidden
            className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
            style={{ left: `${nowPct}%` }}
          />
        )}
      </div>
      <div
        className={cn(
          'font-figure text-[11px] text-muted-foreground',
          compact ? 'flex justify-between text-[10px]' : 'grid grid-cols-8',
        )}
      >
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}
