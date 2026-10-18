import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** White card section with a heading row (title left, aside right). */
export function Panel({
  id,
  title,
  aside,
  flush = false,
  className,
  children,
}: {
  id: string
  title: string
  aside?: ReactNode
  /** Rows run to the panel edge (lists with their own row padding). */
  flush?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex flex-col rounded-[14px] border bg-card',
        flush ? 'gap-1 px-3 pb-3 pt-6' : 'gap-5 p-6',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-2',
          flush && 'px-3 pb-2',
        )}
      >
        <h2 id={id} className="text-[15px] font-semibold">
          {title}
        </h2>
        {aside && (
          <div className="text-[13px] text-muted-foreground">{aside}</div>
        )}
      </div>
      {children}
    </section>
  )
}

/** Muted placeholder line for an empty panel. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/** Monospace figure inline in muted copy. */
export function Fig({ children }: { children: ReactNode }) {
  return <span className="font-figure text-foreground">{children}</span>
}
