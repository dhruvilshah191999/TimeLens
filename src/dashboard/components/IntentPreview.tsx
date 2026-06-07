import { Icon } from '@/components/Icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_CATEGORIES } from '@/lib/constants'

// Phase 1 has no real intent data yet, so this is an illustrative SAMPLE — it
// shows what the intent breakdown will look like once Phase 2 classification
// ships. Clearly labeled so it's never mistaken for real numbers.
const SAMPLE: Record<string, number> = {
  learning: 34,
  work: 18,
  entertainment: 22,
  social: 10,
  news: 6,
  shopping: 4,
  other: 6,
}

export function IntentPreview() {
  const segments = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    pct: SAMPLE[c.id] ?? 0,
  })).filter((s) => s.pct > 0)

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          Time by intent today
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            preview
          </span>
          <Icon name="info" className="text-sm text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-4 w-full overflow-hidden rounded-full opacity-90">
          {segments.map((s) => (
            <div
              key={s.id}
              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              title={`${s.label} ${s.pct}%`}
            />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
          {segments.map((s) => (
            <li key={s.id} className="text-sm">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium">{s.label}</span>
              </span>
              <span className="mt-0.5 block pl-4 text-xs text-muted-foreground">
                {s.pct}%
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Intent classification coming in Phase 2. This is a sample of your
          potential insights — no real intent data yet.
        </p>
      </CardContent>
    </Card>
  )
}
