/**
 * TimeLens brand mark — a lens (concentric ring + focal dot), matching the
 * extension icon. Strokes/fills use currentColor, so set the color on a parent
 * and size with width/height utilities (e.g. className="size-5").
 */
export function LensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </svg>
  )
}
