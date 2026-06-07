import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

/**
 * Lineicons glyph. `name` is the class suffix (without the `lni-` prefix),
 * e.g. <Icon name="stopwatch" />. Size with font-size utilities (text-lg, etc.)
 * since these are icon-font glyphs, not SVGs.
 */
export function Icon({
  name,
  className,
  ...rest
}: { name: string } & HTMLAttributes<HTMLElement>) {
  return (
    <i
      className={cn('lni', `lni-${name}`, 'leading-none', className)}
      aria-hidden
      {...rest}
    />
  )
}
