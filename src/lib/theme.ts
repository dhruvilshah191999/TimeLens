import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// localStorage is shared across all pages of the extension origin, so the
// popup and dashboard stay in sync.
const KEY = 'ttm-theme'

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Call once before first render to avoid a flash of the wrong theme. */
export function initTheme(): void {
  applyTheme(getStoredTheme())
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // ignore storage failures
    }
  }, [theme])

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )

  return { theme, toggle }
}
