/**
 * Local-only site visuals. We deliberately do NOT fetch favicons from any
 * external service (that would leak browsing data) — instead we render a
 * colored monogram. A few well-known brands get their signature color so the
 * list reads naturally; everything else gets a stable hashed hue.
 */

const BRAND_COLORS: Record<string, string> = {
  'netflix.com': '#e50914',
  'youtube.com': '#ff0000',
  'github.com': '#24292f',
  'reddit.com': '#ff4500',
  'twitter.com': '#1d9bf0',
  'x.com': '#0f1419',
  'claude.ai': '#d97757',
  'openai.com': '#10a37f',
  'chatgpt.com': '#10a37f',
  'google.com': '#4285f4',
  'gmail.com': '#ea4335',
  'mail.google.com': '#ea4335',
  'meet.google.com': '#00897b',
  'stackoverflow.com': '#f48024',
  'linkedin.com': '#0a66c2',
  'figma.com': '#a259ff',
  'notion.so': '#0f0f0f',
  'spotify.com': '#1db954',
  'medium.com': '#000000',
  'news.ycombinator.com': '#ff6600',
  'amazon.com': '#ff9900',
  'wikipedia.org': '#202122',
}

function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360
  return h
}

export function siteColor(domain: string): string {
  return BRAND_COLORS[domain] ?? `hsl(${hashHue(domain)} 65% 52%)`
}

export function siteInitial(domain: string): string {
  const base = domain.replace(/^www\./, '')
  return (base[0] ?? '?').toUpperCase()
}
