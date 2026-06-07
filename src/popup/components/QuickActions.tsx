import { Icon } from '@/components/Icon'

export function QuickActions({
  onOpenDashboard,
}: {
  onOpenDashboard: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpenDashboard}
      className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      View full dashboard
      <Icon
        name="arrow-right"
        className="text-base transition-transform group-hover:translate-x-0.5"
      />
    </button>
  )
}
