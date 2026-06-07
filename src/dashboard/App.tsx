import { Icon } from '@/components/Icon'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Insights } from './pages/Insights'
import { Overview } from './pages/Overview'
import { Settings } from './pages/Settings'
import { Weekly } from './pages/Weekly'

const NAV = [
  { to: '/overview', label: 'Overview', icon: 'dashboard-square-1' },
  { to: '/weekly', label: 'Weekly', icon: 'bar-chart-4' },
  { to: '/insights', label: 'Insights', icon: 'bulb-2' },
  { to: '/settings', label: 'Settings', icon: 'gear-1' },
]

function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r bg-card px-3 py-5">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
          <Icon name="stopwatch" className="text-xl" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">TimeLens</p>
          <p className="text-xs text-muted-foreground">Time by intent</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon name={icon} className="relative text-lg" />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 px-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="shield-2" className="shrink-0 text-success" />
          <span>Your data stays on your device</span>
        </div>
        <p className="text-xs text-muted-foreground/70">v0.1.0</p>
      </div>
    </aside>
  )
}

function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-2 border-b bg-background/80 px-8 backdrop-blur">
      <ThemeToggle />
      <span className="flex size-9 items-center justify-center rounded-full bg-brand-gradient text-white">
        <Icon name="user-4" />
      </span>
    </header>
  )
}

export function App() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="scrollbar-thin flex-1 overflow-auto">
        <Topbar />
        <div className="mx-auto max-w-6xl px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Routes location={location}>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/weekly" element={<Weekly />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
