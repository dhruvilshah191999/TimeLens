import { sendMessage } from '@/background/messages'
import { LensMark } from '@/components/LensMark'
import { BarsIcon, ClockIcon, SlidersIcon } from '@/components/icons'
import { useAsync } from '@/lib/use-async'
import { cn } from '@/lib/utils'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Settings } from './pages/Settings'
import { Today } from './pages/Today'
import { Trends } from './pages/Trends'

const NAV = [
  { to: '/today', label: 'Today', Icon: ClockIcon },
  { to: '/trends', label: 'Trends', Icon: BarsIcon },
  { to: '/settings', label: 'Settings', Icon: SlidersIcon },
]

function Rail() {
  const settings = useAsync(() => sendMessage({ type: 'GET_SETTINGS' }), [])
  const range = useAsync(
    () =>
      sendMessage({
        type: 'GET_DAILY_RANGE',
        startDate: '0000-01-01',
        endDate: '9999-12-31',
      }),
    [],
  )
  const days = range.data?.length ?? 0
  const ai = settings.data?.classificationEnabled ?? false

  return (
    <nav
      aria-label="Main"
      className="flex min-w-[200px] max-w-[240px] flex-[1_1_220px] flex-col gap-7 border-r px-[18px] py-7"
    >
      <div className="flex items-center gap-2.5 px-2">
        <LensMark className="size-7" />
        <span className="text-[17px] font-bold tracking-tight">TimeLens</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors',
                isActive
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : 'font-medium text-muted-foreground hover:bg-hover hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3.5 px-2">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Classifier</span>
          <span className="text-[13px] leading-snug">
            Keyword rules
            {ai && (
              <>
                {' '}
                <span className="text-muted-foreground">+</span> Gemini Nano
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="size-1.5 rounded-full bg-success" />
            On device
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Nothing leaves this browser.
          {days > 0 && ` ${days} days stored.`}
        </p>
      </div>
    </nav>
  )
}

export function App() {
  return (
    <div className="flex min-h-screen flex-wrap items-stretch bg-background text-foreground">
      <Rail />
      <main className="min-w-0 flex-[999_1_560px] px-[clamp(16px,4vw,56px)] pb-14 pt-8">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
    </div>
  )
}
