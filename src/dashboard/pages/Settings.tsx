import { sendMessage } from '@/background/messages'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MAX_IDLE_THRESHOLD_SEC, MIN_IDLE_THRESHOLD_SEC } from '@/lib/constants'
import { domainFromUrl } from '@/lib/time-utils'
import type { Settings as SettingsType } from '@/lib/types'
import { useAsync } from '@/lib/use-async'
import { useEffect, useState } from 'react'

export function Settings() {
  const settings = useAsync(() => sendMessage({ type: 'GET_SETTINGS' }), [])
  const [draft, setDraft] = useState<SettingsType | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)

  useEffect(() => {
    if (settings.data) setDraft(settings.data)
  }, [settings.data])

  if (!draft) return <p className="text-muted-foreground">Loading…</p>

  async function patch(p: Partial<SettingsType>) {
    const next = await sendMessage({ type: 'UPDATE_SETTINGS', patch: p })
    setDraft(next)
  }

  function addDomain() {
    const cleaned = domainFromUrl(
      newDomain.includes('://') ? newDomain : `https://${newDomain}`,
    )
    if (!cleaned || draft?.excludedDomains.includes(cleaned)) {
      setNewDomain('')
      return
    }
    void sendMessage({ type: 'EXCLUDE_DOMAIN', domain: cleaned }).then(setDraft)
    setNewDomain('')
  }

  function removeDomain(domain: string) {
    void sendMessage({ type: 'INCLUDE_DOMAIN', domain }).then(setDraft)
  }

  async function exportData() {
    const payload = await sendMessage({ type: 'EXPORT_DATA' })
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timelens-export-${payload.exportedAt}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function resetData() {
    await sendMessage({ type: 'RESET_DATA' })
    setResetConfirm(false)
    settings.reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Tracking preferences and your data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable tracking</Label>
              <p className="text-sm text-muted-foreground">
                Master switch for all time tracking.
              </p>
            </div>
            <Switch
              checked={draft.trackingEnabled}
              onCheckedChange={(v) => patch({ trackingEnabled: v })}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label htmlFor="idle">Idle threshold</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {draft.idleThresholdSec}s
              </span>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">
              Pause tracking after this many seconds of inactivity.
            </p>
            <input
              id="idle"
              type="range"
              min={MIN_IDLE_THRESHOLD_SEC}
              max={MAX_IDLE_THRESHOLD_SEC}
              step={5}
              value={draft.idleThresholdSec}
              onChange={(e) =>
                setDraft({ ...draft, idleThresholdSec: Number(e.target.value) })
              }
              onMouseUp={() =>
                patch({ idleThresholdSec: draft.idleThresholdSec })
              }
              onTouchEnd={() =>
                patch({ idleThresholdSec: draft.idleThresholdSec })
              }
              className="w-full accent-primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excluded sites</CardTitle>
          <CardDescription>
            Time on these domains is never tracked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDomain()
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={addDomain} size="sm">
              <Icon name="plus" className="text-base" />
              Add
            </Button>
          </div>
          {draft.excludedDomains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No excluded sites. Right-click any page → “Stop tracking this
              site”.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {draft.excludedDomains.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-3 pr-1.5 text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeDomain(d)}
                    className="rounded-full p-0.5 hover:bg-background"
                    aria-label={`Remove ${d}`}
                  >
                    <Icon name="xmark" className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything stays on this device. Export or wipe it anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData}>
            <Icon name="download-1" className="text-base" />
            Export as JSON
          </Button>
          {resetConfirm ? (
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={resetData}>
                <Icon name="trash-3" className="text-base" />
                Confirm delete all
              </Button>
              <Button variant="ghost" onClick={() => setResetConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setResetConfirm(true)}
              className="text-destructive hover:text-destructive"
            >
              <Icon name="trash-3" className="text-base" />
              Delete all data
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
