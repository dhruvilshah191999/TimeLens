import { sendMessage } from '@/background/messages'
import { IntentSwatch } from '@/components/IntentViz'
import { CloseIcon, DownloadIcon, RefreshIcon } from '@/components/icons'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_CATEGORIES,
  MAX_IDLE_THRESHOLD_SEC,
  MIN_IDLE_THRESHOLD_SEC,
  RETENTION_DAYS,
} from '@/lib/constants'
import { domainFromUrl } from '@/lib/time-utils'
import type { Settings as SettingsType } from '@/lib/types'
import { useAsync } from '@/lib/use-async'
import { cn } from '@/lib/utils'
import { type ReactNode, useEffect, useState } from 'react'

const AI_STATUS_LABEL: Record<string, string> = {
  available: 'Model ready on this device.',
  downloadable: 'Supported. The model downloads the first time it is needed.',
  downloading: 'Downloading the on-device model…',
  unavailable:
    'Not available on this device, so keyword rules handle everything.',
  unsupported:
    'Not supported in this browser, so keyword rules handle everything. Enable the Prompt API for Gemini Nano in chrome://flags to use it.',
}

const buttonBase =
  'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition-colors disabled:opacity-50'
const outlineButton = cn(buttonBase, 'border bg-card hover:bg-hover')

/** One settings group: a label column beside a card. */
function Group({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-8 gap-y-4 border-t pt-6"
    >
      <div className="flex max-w-[240px] flex-col gap-1.5">
        <h2 id={id} className="text-[15px] font-semibold">
          {title}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </div>
      <div className="col-span-2 flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  )
}

function Card({
  className,
  children,
}: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn('flex flex-col rounded-[14px] border bg-card', className)}
    >
      {children}
    </div>
  )
}

/** A card row: label and description on the left, a control on the right. */
function Row({
  label,
  description,
  control,
  last = false,
}: {
  label: ReactNode
  description: ReactNode
  control: ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 px-5 py-[18px]',
        !last && 'border-b border-border/60',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">{description}</span>
      </div>
      {control}
    </div>
  )
}

export function Settings() {
  const settings = useAsync(() => sendMessage({ type: 'GET_SETTINGS' }), [])
  // Poll so model-download progress updates live while it's fetching.
  const ai = useAsync(() => sendMessage({ type: 'GET_AI_STATUS' }), [], 2000)
  const exportInfo = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: '0000-01-01',
        endDate: '9999-12-31',
      }),
    [],
  )
  const [draft, setDraft] = useState<SettingsType | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [reclassMsg, setReclassMsg] = useState<string | null>(null)

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
    exportInfo.reload()
  }

  async function toggleAi(v: boolean) {
    await patch({ classificationEnabled: v })
    ai.reload() // pick up the new state / kicked-off download promptly
  }

  async function reclassify() {
    setReclassifying(true)
    setReclassMsg(null)
    try {
      const res = await sendMessage({ type: 'RECLASSIFY_ALL' })
      setReclassMsg(
        `Relabelled ${res.count} session${res.count === 1 ? '' : 's'}.`,
      )
    } finally {
      setReclassifying(false)
    }
  }

  const download = ai.data?.download
  const days = exportInfo.data?.length ?? 0

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-8">
      <h1 className="text-[34px] font-bold tracking-[-0.02em]">Settings</h1>

      <Group
        id="trk-h"
        title="Tracking"
        hint="Only the focused tab counts. Time pauses when you step away."
      >
        <Card>
          <Row
            label="Track browsing time"
            description="Turn off to pause everything."
            control={
              <Switch
                checked={draft.trackingEnabled}
                onCheckedChange={(v) => patch({ trackingEnabled: v })}
                aria-label="Track browsing time"
              />
            }
          />
          <div className="flex flex-col gap-3 px-5 py-[18px]">
            <div className="flex items-baseline justify-between">
              <label htmlFor="idle" className="text-sm font-medium">
                Pause after inactivity
              </label>
              <span className="font-figure text-sm">
                {draft.idleThresholdSec}s
              </span>
            </div>
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
              onKeyUp={() =>
                patch({ idleThresholdSec: draft.idleThresholdSec })
              }
              className="w-full accent-primary"
            />
            <div className="font-figure flex justify-between text-[11px] text-muted-foreground">
              <span>{MIN_IDLE_THRESHOLD_SEC}s</span>
              <span>{MAX_IDLE_THRESHOLD_SEC / 60}m</span>
            </div>
            <span className="text-[13px] text-muted-foreground">
              Audible tabs (videos, calls) keep counting while you watch.
            </span>
          </div>
        </Card>
      </Group>

      <Group
        id="cls-h"
        title="Intent"
        hint="How each page gets a label. Both engines run on this device."
      >
        <Card>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/60 px-5 py-[18px]">
            <span className="font-figure text-xs text-muted-foreground">
              01
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Keyword rules</span>
              <span className="text-[13px] text-muted-foreground">
                Known sites plus title keywords. Instant, always on.
              </span>
            </div>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
              Active
            </span>
          </div>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-[18px]">
            <span className="font-figure text-xs text-muted-foreground">
              02
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Gemini Nano, for unclear pages
              </span>
              <span className="text-[13px] text-muted-foreground">
                Asked only when the rules are unsure.{' '}
                {ai.data &&
                  (AI_STATUS_LABEL[ai.data.availability] ??
                    ai.data.availability)}
              </span>
            </div>
            <Switch
              checked={draft.classificationEnabled}
              onCheckedChange={toggleAi}
              aria-label="Use Gemini Nano for unclear pages"
            />
          </div>
          {download?.state === 'downloading' && (
            <div className="flex flex-col gap-1.5 px-5 pb-[18px]">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Downloading on-device model…</span>
                <span className="font-figure">
                  {Math.round(download.progress * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(download.progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </Card>

        <Card className="gap-3.5 px-5 py-[18px]">
          <span className="text-sm font-medium">Categories</span>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.map((c) => (
              <span
                key={c.id}
                className="flex min-h-8 items-center gap-2 rounded-lg border px-3 text-[13px]"
              >
                <IntentSwatch intent={c.id} />
                {c.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5">
            <span className="text-[13px] text-muted-foreground">
              {reclassMsg ??
                'Relabel every stored session with the current engines.'}
            </span>
            <button
              type="button"
              onClick={reclassify}
              disabled={reclassifying}
              className={outlineButton}
            >
              <RefreshIcon
                className={cn('size-4', reclassifying && 'animate-spin')}
              />
              {reclassifying ? 'Relabelling…' : 'Relabel all history'}
            </button>
          </div>
        </Card>
      </Group>

      <Group
        id="exc-h"
        title="Never track"
        hint="Or right-click any page and choose “Stop tracking this site”."
      >
        <Card className="gap-3.5 px-5 py-[18px]">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addDomain()
            }}
          >
            <label htmlFor="dom" className="sr-only">
              Site to exclude
            </label>
            <input
              id="dom"
              type="text"
              placeholder="bank.example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="min-h-11 flex-[1_1_220px] rounded-[10px] border bg-background px-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className={cn(
                buttonBase,
                'bg-primary text-primary-foreground hover:opacity-90',
              )}
            >
              Exclude
            </button>
          </form>
          {draft.excludedDomains.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No excluded sites yet.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {draft.excludedDomains.map((d) => (
                <li
                  key={d}
                  className="flex min-h-9 items-center gap-1 rounded-lg bg-background pl-3 pr-1 text-[13px]"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeDomain(d)}
                    aria-label={`Remove ${d}`}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-hover hover:text-foreground"
                  >
                    <CloseIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Group>

      <Group
        id="data-h"
        title="Your data"
        hint={`Sessions older than ${RETENTION_DAYS} days are removed on their own.`}
      >
        <Card>
          <Row
            label="Export"
            description={
              days > 0
                ? `All sessions and ${days} daily totals as JSON.`
                : 'All sessions and daily totals as JSON.'
            }
            control={
              <button
                type="button"
                onClick={exportData}
                className={outlineButton}
              >
                <DownloadIcon className="size-4" />
                Download JSON
              </button>
            }
          />
          <Row
            last
            label="Delete everything"
            description="Removes all history from this browser. Can’t be undone."
            control={
              resetConfirm ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetConfirm(false)}
                    className={outlineButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={resetData}
                    className={cn(
                      buttonBase,
                      'bg-destructive text-destructive-foreground hover:opacity-90',
                    )}
                  >
                    Yes, delete all
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResetConfirm(true)}
                  className={cn(
                    outlineButton,
                    'border-destructive/30 text-destructive',
                  )}
                >
                  Delete all data
                </button>
              )
            }
          />
        </Card>
      </Group>
    </div>
  )
}
