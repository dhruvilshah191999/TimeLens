import { Icon } from '@/components/Icon'
import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function StatCard({
  icon,
  tint,
  label,
  value,
  footer,
}: {
  /** Lineicons name (without the `lni-` prefix). */
  icon: string
  /** base color for the icon badge, e.g. "#6366f1" */
  tint: string
  label: string
  value: ReactNode
  footer?: ReactNode
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${tint}1f`, color: tint }}
          >
            <Icon name={icon} className="text-xl" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <div className="mt-0.5 truncate text-2xl font-bold tracking-tight">
              {value}
            </div>
            {footer && (
              <div className="mt-1 text-xs text-muted-foreground">{footer}</div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
