import { SiteIcon } from '@/components/SiteIcon'
import { formatClock } from '@/lib/time-utils'

/** Live "currently tracking" strip: favicon · site · running session timer. */
export function NowTracking({
  domain,
  url,
  elapsedMs,
}: {
  domain: string | null
  url: string | null
  elapsedMs: number | null
}) {
  if (!domain || elapsedMs == null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
        Not tracking right now
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Now
      </span>
      <SiteIcon domain={domain} url={url ?? undefined} className="size-5" />
      <span
        className="min-w-0 flex-1 truncate text-sm font-medium"
        title={domain}
      >
        {domain}
      </span>
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {formatClock(elapsedMs)}
      </span>
    </div>
  )
}
