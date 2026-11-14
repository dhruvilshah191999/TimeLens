/** Monogram letter for a domain, used when no local favicon is cached. */
export function siteInitial(domain: string): string {
  const base = domain.replace(/^www\./, '')
  return (base[0] ?? '?').toUpperCase()
}
