/**
 * TimeLens brand mark — a lens ring with a focal dot and two clock ticks.
 * Strokes/fills use currentColor, so set the color on a parent and size with
 * width/height utilities (e.g. className="size-5").
 */
export function LensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="14" cy="14" r="5.5" fill="currentColor" />
      <path
        d="M14 2v4M26 14h-4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
