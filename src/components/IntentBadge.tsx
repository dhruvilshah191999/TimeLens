import { categoryFor } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Small pill showing a session's classified intent, tinted with the category
 * color. Renders nothing when the intent is unknown.
 */
export function IntentBadge({
  intent,
  className,
}: {
  intent: string | undefined
  className?: string
}) {
  if (!intent) return null
  const cat = categoryFor(intent)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${cat.color} 14%, transparent)`,
        color: `color-mix(in srgb, ${cat.color} 75%, hsl(var(--foreground)))`,
      }}
    >
      {cat.label}
    </span>
  )
}
