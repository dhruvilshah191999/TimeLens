import { format } from 'date-fns'

/** Local calendar date key, e.g. "2026-06-03". Matches DailyTotal.date. */
export function dateKey(date: Date | number): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Format a duration in ms as a compact human string.
 * 0 -> "0m", 90_000 -> "1m", 3_660_000 -> "1h 1m", 45_000 -> "45s".
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

/** Long form for tooltips: "1h 23m 45s". */
export function formatDurationLong(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.round(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  return [
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    seconds && `${seconds}s`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** Extract a registrable-ish domain from a URL. Returns '' for non-http(s). */
export function domainFromUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Sort a Record<string, number> into descending [key, value] pairs. */
export function sortedEntries(
  record: Record<string, number>,
): [string, number][] {
  return Object.entries(record).sort((a, b) => b[1] - a[1])
}

/** Top N entries of a totals record, with the rest folded into "Other". */
export function topNWithOther(
  record: Record<string, number>,
  n: number,
  otherLabel = 'Other',
): [string, number][] {
  const sorted = sortedEntries(record)
  if (sorted.length <= n) return sorted
  const top = sorted.slice(0, n)
  const rest = sorted.slice(n).reduce((sum, [, v]) => sum + v, 0)
  if (rest > 0) top.push([otherLabel, rest])
  return top
}
