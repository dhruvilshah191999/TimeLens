import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Run an async loader on mount and expose a reload(). Used by popup/dashboard
 * to fetch data from the background service worker over the message bus.
 * Pass `refreshMs` to also poll on an interval (keeps live views current).
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  refreshMs?: number,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  // nonce drives reload(); caller deps are spread in intentionally; loader is
  // recreated each render by design and must not be a dependency.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see note above
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [nonce, ...deps])

  useEffect(() => {
    if (!refreshMs) return
    const id = setInterval(reload, refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, reload])

  return { data, loading, error, reload }
}
