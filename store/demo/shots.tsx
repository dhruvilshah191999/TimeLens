import { LensMark } from '@/components/LensMark'
import { DEFAULT_CATEGORIES } from '@/lib/constants'
import { App as Dashboard } from '@/dashboard/App'
import { App as Popup } from '@/popup/App'
import type { CSSProperties, ReactNode } from 'react'

const INK = '#16181B'
const GROUND = '#F3F4F1'
const MUTED = '#5F646B'
const sans = "'Schibsted Grotesk', system-ui, sans-serif"

/** Thin bar of the intent palette, used as the brand stripe on promo art. */
function IntentStripe({ height, style }: { height: number; style?: CSSProperties }) {
  const weights = [30, 26, 6, 12, 5, 9, 4]
  return (
    <div style={{ display: 'flex', gap: 3, height, ...style }}>
      {DEFAULT_CATEGORIES.map((c, i) => (
        <div key={c.id} style={{ flex: weights[i], background: c.color, borderRadius: 3 }} />
      ))}
    </div>
  )
}

/** Marketing frame: headline on the left, the real popup on the right. */
function PopupFrame({ title, body }: { title: ReactNode; body: string }) {
  return (
    <div
      style={{
        width: 1280,
        height: 800,
        background: GROUND,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 96,
        fontFamily: sans,
        color: INK,
        boxSizing: 'border-box',
        padding: '0 96px',
      }}
    >
      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LensMark className="size-9" />
          <span style={{ fontSize: 22, fontWeight: 700 }}>TimeLens</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1.05, letterSpacing: '-0.03em', fontWeight: 700 }}>
          {title}
        </h1>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5, color: MUTED }}>{body}</p>
        <IntentStripe height={10} style={{ width: 320, marginTop: 8 }} />
      </div>
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid #E1E3DF',
          boxShadow: '0 24px 60px rgba(22,24,27,0.16), 0 2px 6px rgba(22,24,27,0.08)',
          flex: 'none',
        }}
      >
        <Popup />
      </div>
    </div>
  )
}

/** Promo tile / marquee: graphite ground, mark, name, tagline, stripe. */
function Promo({ width, height }: { width: number; height: number }) {
  const big = width > 600
  return (
    <div
      style={{
        width,
        height,
        background: INK,
        color: '#ECEDEA',
        fontFamily: sans,
        boxSizing: 'border-box',
        padding: big ? 72 : 36,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 18 : 12 }}>
        <LensMark className={big ? 'size-14' : 'size-9'} />
        <span style={{ fontSize: big ? 40 : 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
          TimeLens
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 28 : 18 }}>
        <p
          style={{
            margin: 0,
            fontSize: big ? 56 : 26,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            maxWidth: big ? 900 : 380,
          }}
        >
          Time by intent, not just by site.
        </p>
        <IntentStripe height={big ? 14 : 8} />
      </div>
    </div>
  )
}

/** Full dashboard at the store's 1280×800 screenshot size. */
function DashboardShot() {
  return (
    <div style={{ width: 1280, height: 800, overflow: 'hidden' }}>
      <Dashboard />
    </div>
  )
}

export function Shot({ name }: { name: string }) {
  switch (name) {
    case 'trends':
    case 'settings':
      return <DashboardShot />
    case 'popup':
      return (
        <PopupFrame
          title="Same site, different reasons."
          body="A YouTube tutorial counts as Learning, a stand-up clip as Entertainment. TimeLens labels every page by why you were there."
        />
      )
    case 'promo-small':
      return <Promo width={440} height={280} />
    case 'marquee':
      return <Promo width={1400} height={560} />
    default:
      return <DashboardShot />
  }
}
