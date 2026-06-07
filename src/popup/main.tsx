import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/lineicons.css'
import '@/styles/globals.css'
import { initTheme } from '@/lib/theme'
import { App } from './App'

initTheme()

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
