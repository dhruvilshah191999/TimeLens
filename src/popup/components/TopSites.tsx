import { SiteIcon } from '@/components/SiteIcon'
import { formatDuration, sortedEntries } from '@/lib/time-utils'

/** Ranked top sites with favicon + duration + a thin magnitude track. */
export function TopSites({
  byDomain,
  urlByDomain = {},
}: {
  byDomain: Record<string, number>
  /** Real page URL per domain, for accurate local favicon lookups. */
  urlByDomain?: Record<string, string>
}) {
  const rows = sortedEntries(byDomain).slice(0, 4)
  const max = rows[0]?.[1] ?? 1

  if (rows.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        Nothing tracked yet today.
      </p>
    )
  }

  return (
    <div>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Top sites
      </p>
      <ul className="space-y-2.5">
        {rows.map(([domain, ms]) => (
          <li key={domain} className="flex items-center gap-2.5">
            <SiteIcon
              domain={domain}
              url={urlByDomain[domain]}
              className="size-5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm" title={domain}>
                  {domain}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDuration(ms)}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(4, (ms / max) * 100)}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
