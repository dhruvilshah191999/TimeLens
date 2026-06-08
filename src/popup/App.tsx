import { sendMessage } from '@/background/messages'
import { Icon } from '@/components/Icon'
import { LensMark } from '@/components/LensMark'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { formatDurationLong } from '@/lib/time-utils'
import { useAsync } from '@/lib/use-async'
import { motion } from 'framer-motion'
import { IntentBar } from './components/IntentBar'
import { NowTracking } from './components/NowTracking'
import { TopSites } from './components/TopSites'

export function App() {
  // Tick every second while the popup is open (live total + session timer).
  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 1000)
  const status = useAsync(() => sendMessage({ type: 'GET_STATUS' }), [], 1000)
  // Recent sessions give us real page URLs per domain so the local favicon
  // lookup matches Chrome's cache (e.g. www.cricbuzz.com, not cricbuzz.com).
  const recent = useAsync(
    () => sendMessage({ type: 'GET_RECENT_SESSIONS', limit: 30 }),
    [],
    5000,
  )

  async function toggleTracking(enabled: boolean) {
    await sendMessage({ type: 'SET_TRACKING', enabled })
    status.reload()
    today.reload()
  }

  const trackingEnabled = status.data?.trackingEnabled ?? true
  const totalMs = today.data?.totalMs ?? 0
  const byDomain = today.data?.byDomain ?? {}

  // Most-recent page URL per domain for favicon lookups.
  const urlByDomain: Record<string, string> = {}
  if (status.data?.currentDomain && status.data.currentUrl) {
    urlByDomain[status.data.currentDomain] = status.data.currentUrl
  }
  for (const s of recent.data ?? []) {
    if (!urlByDomain[s.domain]) urlByDomain[s.domain] = s.url
  }

  return (
    <motion.div
      className="w-[360px] bg-background p-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Card className="overflow-hidden shadow-sm">
        {/* Header */}
        <header className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LensMark className="size-[18px]" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              TimeLens
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${
                  trackingEnabled ? 'bg-success' : 'bg-muted-foreground/40'
                }`}
              />
              {trackingEnabled ? 'Live' : 'Paused'}
            </span>
            <Switch
              checked={trackingEnabled}
              onCheckedChange={toggleTracking}
              aria-label="Toggle tracking"
            />
          </div>
        </header>

        {/* Now tracking */}
        <div className="border-t px-4 py-3">
          <NowTracking
            domain={status.data?.currentDomain ?? null}
            url={status.data?.currentUrl ?? null}
            elapsedMs={status.data?.sessionElapsedMs ?? null}
          />
        </div>

        {/* Hero total */}
        <div className="px-4 pb-3 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Today
          </p>
          <p className="mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums">
            {formatDurationLong(totalMs)}
          </p>
        </div>

        {/* By intent */}
        <div className="px-4 pb-4 pt-1">
          <IntentBar />
        </div>

        {/* Top sites */}
        <div className="border-t px-4 py-3.5">
          <TopSites byDomain={byDomain} urlByDomain={urlByDomain} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon name="shield-2" className="text-success" />
            Everything stays on your device
          </span>
          <button
            type="button"
            onClick={() => chrome.runtime.openOptionsPage()}
            className="group flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
            <Icon
              name="arrow-right"
              className="text-sm transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </Card>
    </motion.div>
  )
}
