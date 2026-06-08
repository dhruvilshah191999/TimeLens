import { DEFAULT_CATEGORIES } from '@/lib/constants'

// Intent classification is Phase 2, so this is a clearly-labeled SAMPLE that
// shows the product's signature view. It swaps to real data once Phase 2 lands.
const SAMPLE: { id: string; pct: number }[] = [
  { id: 'learning', pct: 42 },
  { id: 'work', pct: 28 },
  { id: 'entertainment', pct: 18 },
  { id: 'social', pct: 12 },
]

const CAT = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c]))

export function IntentBar() {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          By intent
        </p>
        <span className="rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          preview
        </span>
      </div>

      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {SAMPLE.map((s) => (
          <div
            key={s.id}
            style={{ width: `${s.pct}%`, backgroundColor: CAT[s.id]?.color }}
            className="first:rounded-l-full last:rounded-r-full"
            title={`${CAT[s.id]?.label} ${s.pct}%`}
          />
        ))}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SAMPLE.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: CAT[s.id]?.color }}
            />
            <span className="flex-1 truncate text-muted-foreground">
              {CAT[s.id]?.label}
            </span>
            <span className="tabular-nums font-medium">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
