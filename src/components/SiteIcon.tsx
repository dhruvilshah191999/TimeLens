import { siteColor, siteInitial } from '@/lib/site-meta'
import { cn } from '@/lib/utils'
import { useState } from 'react'

/**
 * Site icon for a domain. Tries Chrome's LOCAL favicon cache via the
 * `_favicon/` API (no network request — privacy-safe), and falls back to a
 * colored monogram if the favicon fails to load.
 */

/** Build a chrome-extension://…/_favicon/ URL that reads the local cache. */
function faviconUrl(pageUrl: string, size = 32): string {
  const u = new URL(chrome.runtime.getURL('/_favicon/'))
  u.searchParams.set('pageUrl', pageUrl)
  u.searchParams.set('size', String(size))
  return u.toString()
}

export function SiteIcon({
  domain,
  url,
  className,
}: {
  domain: string
  /** Full page URL for the most accurate cache lookup; defaults to the domain. */
  url?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const pageUrl = url || `https://${domain}/`

  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold text-white',
        className,
      )}
      style={
        failed
          ? { backgroundColor: siteColor(domain) }
          : { backgroundColor: 'hsl(var(--secondary))' }
      }
    >
      {failed ? (
        siteInitial(domain)
      ) : (
        <img
          src={faviconUrl(pageUrl)}
          alt=""
          className="size-full object-contain p-0.5"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}
