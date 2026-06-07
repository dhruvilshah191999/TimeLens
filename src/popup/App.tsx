import { sendMessage } from '@/background/messages'
import { Icon } from '@/components/Icon'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAsync } from '@/lib/use-async'
import { motion } from 'framer-motion'
import { IntentBreakdown } from './components/IntentBreakdown'
import { QuickActions } from './components/QuickActions'
import { TodayStats } from './components/TodayStats'

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-secondary/30 px-4 py-8 text-center">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon name="stopwatch" className="text-2xl" />
      </span>
      <p className="text-sm font-semibold">No time tracked yet</p>
      <p className="mx-auto mt-1 max-w-[240px] text-xs text-muted-foreground">
        Open a tab and TimeLens will start tracking locally.
      </p>
    </div>
  )
}

export function App() {
  // Tick the live total every second while the popup is open.
  const today = useAsync(() => sendMessage({ type: 'GET_TODAY' }), [], 1000)
  const hourly = useAsync(
    () => sendMessage({ type: 'GET_TODAY_HOURLY' }),
    [],
    5000,
  )
  const status = useAsync(() => sendMessage({ type: 'GET_STATUS' }), [])

  async function toggleTracking(enabled: boolean) {
    await sendMessage({ type: 'SET_TRACKING', enabled })
    status.reload()
    today.reload()
  }

  const trackingEnabled = status.data?.trackingEnabled ?? true
  const totalMs = today.data?.totalMs ?? 0
  const byDomain = today.data?.byDomain ?? {}
  const hasData = totalMs > 0 && Object.keys(byDomain).length > 0

  return (
    <motion.div
      className="w-[360px] bg-background p-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <Card className="space-y-4 p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
              <Icon name="stopwatch" className="text-xl" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">TimeLens</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {trackingEnabled ? (
                  <>
                    <span className="size-1.5 rounded-full bg-success" />
                    Live
                  </>
                ) : (
                  'Paused'
                )}
              </p>
            </div>
          </div>
          <Switch
            checked={trackingEnabled}
            onCheckedChange={toggleTracking}
            aria-label="Toggle tracking"
          />
        </header>

        <TodayStats totalMs={totalMs} hourly={hourly.data ?? []} />

        {hasData ? <IntentBreakdown byDomain={byDomain} /> : <EmptyState />}

        <QuickActions
          onOpenDashboard={() => chrome.runtime.openOptionsPage()}
        />
      </Card>
    </motion.div>
  )
}
