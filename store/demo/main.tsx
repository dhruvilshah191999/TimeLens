// The mock must load first: it fakes the clock and the chrome.* message bus.
import './mock'
import '@fontsource/schibsted-grotesk/latin-400.css'
import '@fontsource/schibsted-grotesk/latin-500.css'
import '@fontsource/schibsted-grotesk/latin-600.css'
import '@fontsource/schibsted-grotesk/latin-700.css'
import '@fontsource/martian-mono/latin-400.css'
import '@fontsource/martian-mono/latin-500.css'
import '@/styles/globals.css'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Shot } from './shots'

const params = new URLSearchParams(location.search)
// Set theme and route before the app mounts: the theme hook reads storage on
// mount and the router reads the hash once at startup.
localStorage.setItem('ttm-theme', params.get('theme') === 'dark' ? 'dark' : 'light')
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark')
const ROUTES: Record<string, string> = { trends: '/trends', settings: '/settings' }
location.hash = ROUTES[params.get('shot') ?? ''] ?? '/today'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <HashRouter>
      <Shot name={params.get('shot') ?? 'today'} />
    </HashRouter>,
  )
}
