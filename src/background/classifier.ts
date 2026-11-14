/**
 * On-device intent classification (Phase 2).
 *
 * Two tiers, both 100% local — nothing ever leaves the browser:
 *  1. A deterministic domain + keyword ruleset. Instant, always available, and
 *     the source of truth for backfill and the live hot path.
 *  2. Chrome's built-in Gemini Nano (the Prompt API / `LanguageModel`), used
 *     ONLY to refine low-confidence rule guesses and ONLY when the user has
 *     opted in (Settings → Smart classification) and the model is present.
 *
 * If Nano is unavailable or errors, we silently fall back to the rule result,
 * so classification always produces an answer.
 */
import type { IntentId } from '@/lib/types'

export interface ClassifyResult {
  intent: IntentId
  /** 0–1. Rule matches range 0.3–0.9; AI refinement is AI_CONFIDENCE. */
  confidence: number
  source: 'rule' | 'ai'
}

/** Below this rule confidence we ask the AI tier to take a second look. */
const AI_REFINE_BELOW = 0.85

/**
 * Confidence stored for an AI answer. Deliberately below a known-domain rule
 * (0.9) so AI guesses stay distinguishable from deterministic matches.
 */
const AI_CONFIDENCE = 0.7

/** chrome.storage.local key for cached AI answers (keeps labels stable). */
const AI_CACHE_KEY = 'ai-intent-cache'
const AI_CACHE_MAX = 2000

// ---------------------------------------------------------------------------
// Tier 1 — rules
// ---------------------------------------------------------------------------

/**
 * Exact domain → intent. Domains are stored without the `www.` prefix to match
 * domainFromUrl(). Subdomains fall back to their registrable parent via the
 * suffix scan in domainIntent().
 */
const DOMAIN_INTENT: Record<string, IntentId> = {
  // Work / productivity / dev
  'github.com': 'work',
  'gitlab.com': 'work',
  'bitbucket.org': 'work',
  'stackoverflow.com': 'work',
  'stackexchange.com': 'work',
  'npmjs.com': 'work',
  'notion.so': 'work',
  'notion.com': 'work',
  'slack.com': 'work',
  'linear.app': 'work',
  'figma.com': 'work',
  'atlassian.net': 'work',
  'jira.com': 'work',
  'asana.com': 'work',
  'trello.com': 'work',
  'monday.com': 'work',
  'clickup.com': 'work',
  'vercel.com': 'work',
  'netlify.com': 'work',
  'cloudflare.com': 'work',
  'aws.amazon.com': 'work',
  'console.cloud.google.com': 'work',
  'portal.azure.com': 'work',
  'codepen.io': 'work',
  'codesandbox.io': 'work',
  'replit.com': 'work',
  'docs.google.com': 'work',
  'sheets.google.com': 'work',
  'drive.google.com': 'work',
  'mail.google.com': 'work',
  'outlook.com': 'work',
  'outlook.office.com': 'work',
  'meet.google.com': 'work',
  'zoom.us': 'work',
  'teams.microsoft.com': 'work',
  'overleaf.com': 'work',
  localhost: 'work',

  // Learning
  'dev.to': 'learning',
  'medium.com': 'learning',
  'freecodecamp.org': 'learning',
  'coursera.org': 'learning',
  'udemy.com': 'learning',
  'edx.org': 'learning',
  'khanacademy.org': 'learning',
  'pluralsight.com': 'learning',
  'w3schools.com': 'learning',
  'geeksforgeeks.org': 'learning',
  'leetcode.com': 'learning',
  'hackerrank.com': 'learning',
  'brilliant.org': 'learning',
  'wikipedia.org': 'learning',
  'developer.mozilla.org': 'learning',
  'css-tricks.com': 'learning',
  'smashingmagazine.com': 'learning',
  'baeldung.com': 'learning',
  'tutorialspoint.com': 'learning',
  'docs.python.org': 'learning',
  'react.dev': 'learning',

  // Entertainment
  'netflix.com': 'entertainment',
  'primevideo.com': 'entertainment',
  'hotstar.com': 'entertainment',
  'disneyplus.com': 'entertainment',
  'hulu.com': 'entertainment',
  'hbomax.com': 'entertainment',
  'max.com': 'entertainment',
  'twitch.tv': 'entertainment',
  'spotify.com': 'entertainment',
  'soundcloud.com': 'entertainment',
  'crunchyroll.com': 'entertainment',
  '9gag.com': 'entertainment',
  'imdb.com': 'entertainment',

  // Social
  'facebook.com': 'social',
  'instagram.com': 'social',
  'twitter.com': 'social',
  'x.com': 'social',
  'linkedin.com': 'social',
  'reddit.com': 'social',
  'tiktok.com': 'social',
  'snapchat.com': 'social',
  'pinterest.com': 'social',
  'whatsapp.com': 'social',
  'discord.com': 'social',
  'threads.net': 'social',
  'telegram.org': 'social',
  'web.telegram.org': 'social',
  'quora.com': 'social',

  // News
  'cnn.com': 'news',
  'bbc.com': 'news',
  'bbc.co.uk': 'news',
  'nytimes.com': 'news',
  'theguardian.com': 'news',
  'reuters.com': 'news',
  'bloomberg.com': 'news',
  'techcrunch.com': 'news',
  'theverge.com': 'news',
  'arstechnica.com': 'news',
  'news.ycombinator.com': 'news',
  'ndtv.com': 'news',
  'timesofindia.indiatimes.com': 'news',
  'indianexpress.com': 'news',
  'espn.com': 'news',
  'cricbuzz.com': 'news',
  'wsj.com': 'news',

  // Shopping
  'amazon.com': 'shopping',
  'amazon.in': 'shopping',
  'amazon.co.uk': 'shopping',
  'flipkart.com': 'shopping',
  'ebay.com': 'shopping',
  'etsy.com': 'shopping',
  'walmart.com': 'shopping',
  'aliexpress.com': 'shopping',
  'myntra.com': 'shopping',
  'bestbuy.com': 'shopping',
  'target.com': 'shopping',
  'ikea.com': 'shopping',

  // Subdomains whose intent differs from their parent
  'news.google.com': 'news',
  'music.youtube.com': 'entertainment',
  'accounts.google.com': 'other',
}

/**
 * Domains whose intent depends on content (e.g. YouTube is Learning when you're
 * watching a tutorial, Entertainment otherwise). Resolved via title/url keywords
 * with a sensible default.
 */
const AMBIGUOUS: Record<string, { learn: IntentId; default: IntentId }> = {
  'youtube.com': { learn: 'learning', default: 'entertainment' },
  'm.youtube.com': { learn: 'learning', default: 'entertainment' },
  // AI assistants: studying a topic is Learning, everything else is Work.
  'chatgpt.com': { learn: 'learning', default: 'work' },
  'chat.openai.com': { learn: 'learning', default: 'work' },
  'claude.ai': { learn: 'learning', default: 'work' },
  'gemini.google.com': { learn: 'learning', default: 'work' },
  'perplexity.ai': { learn: 'learning', default: 'work' },
  'copilot.microsoft.com': { learn: 'learning', default: 'work' },
}

const LEARN_KEYWORDS = [
  'tutorial',
  'course',
  'learn',
  'learning',
  'lesson',
  'lecture',
  'how to',
  'how-to',
  'guide',
  'documentation',
  'docs',
  'explained',
  'crash course',
  'walkthrough',
  'beginners',
  'introduction to',
]

/** Generic title/url keyword hints when the domain itself is unknown. */
const KEYWORD_INTENT: { intent: IntentId; words: string[] }[] = [
  {
    intent: 'shopping',
    words: ['cart', 'checkout', 'add to bag', 'buy now', 'order summary'],
  },
  { intent: 'learning', words: LEARN_KEYWORDS },
  { intent: 'news', words: ['breaking news', 'headlines', 'live updates'] },
  {
    intent: 'work',
    words: [
      'dashboard',
      'pull request',
      'merge request',
      'jira',
      'ticket',
      'console',
      'admin',
    ],
  },
]

/**
 * Whole-word keyword match (an optional trailing "s" allows plurals), so
 * "cart" doesn't fire on "cartoon" and "course" still matches "courses".
 */
const wordPatterns = new Map<string, RegExp>()
function wordPattern(word: string): RegExp {
  let re = wordPatterns.get(word)
  if (!re) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = new RegExp(`(?:^|[^a-z0-9])${escaped}s?(?=$|[^a-z0-9])`)
    wordPatterns.set(word, re)
  }
  return re
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => wordPattern(n).test(haystack))
}

/** Match a domain against the maps, walking up subdomains (a.b.example.com). */
function domainIntent(domain: string): IntentId | null {
  if (DOMAIN_INTENT[domain]) return DOMAIN_INTENT[domain]
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.')
    if (DOMAIN_INTENT[parent]) return DOMAIN_INTENT[parent]
  }
  return null
}

/**
 * Deterministic, instant classification from domain + title + url. Always
 * returns a result. Used everywhere on the hot path and for backfill.
 */
export function classifyByRules(input: {
  domain: string
  url: string
  title: string
}): ClassifyResult {
  const domain = input.domain.toLowerCase()
  const text = `${input.title} ${input.url}`.toLowerCase()

  // Content-dependent domains (YouTube etc.).
  const amb = AMBIGUOUS[domain]
  if (amb) {
    if (hasAny(text, LEARN_KEYWORDS)) {
      return { intent: amb.learn, confidence: 0.8, source: 'rule' }
    }
    return { intent: amb.default, confidence: 0.6, source: 'rule' }
  }

  // Known domain.
  const byDomain = domainIntent(domain)
  if (byDomain) return { intent: byDomain, confidence: 0.9, source: 'rule' }

  // Unknown domain — fall back to title/url keyword hints.
  for (const { intent, words } of KEYWORD_INTENT) {
    if (hasAny(text, words)) {
      return { intent, confidence: 0.55, source: 'rule' }
    }
  }

  return { intent: 'other', confidence: 0.3, source: 'rule' }
}

// ---------------------------------------------------------------------------
// Tier 2 — Chrome built-in AI (Gemini Nano), on-device only
// ---------------------------------------------------------------------------

const INTENT_IDS: IntentId[] = [
  'learning',
  'work',
  'entertainment',
  'social',
  'news',
  'shopping',
  'other',
]

const AI_SYSTEM_PROMPT = `You label a web page with ONE intent category from this exact list: learning, work, entertainment, social, news, shopping, other.
Reply with ONLY the single category word, lowercase, nothing else.
Guidance: learning = courses/tutorials/docs/study. work = dev tools, productivity, email, meetings, dashboards. entertainment = video/music/streaming/games/memes. social = social networks and messaging. news = news and current events. shopping = stores and product pages. other = anything that fits none.`

interface AiSession {
  prompt(input: string): Promise<string>
  clone?(): Promise<AiSession>
  destroy?(): void
}

/** Cached model handle. Not tracking state — safe to recreate after worker restarts. */
let aiSession: AiSession | null = null

interface LanguageModelLike {
  availability(): Promise<string>
  create(opts?: {
    initialPrompts?: { role: string; content: string }[]
    monitor?: (m: EventTarget) => void
    temperature?: number
    topK?: number
  }): Promise<AiSession>
}

/** Progress of the on-device model preparation, surfaced to the Settings UI. */
export interface AiProgress {
  state: 'idle' | 'downloading' | 'ready' | 'unavailable'
  /** Download fraction 0–1 while state === 'downloading'. */
  progress: number
}

function getLanguageModel(): LanguageModelLike | null {
  // The Prompt API surfaces as a `LanguageModel` global in extension workers on
  // supported Chrome builds. Legacy builds exposed it under `self.ai`.
  const g = self as unknown as {
    LanguageModel?: LanguageModelLike
    ai?: { languageModel?: LanguageModelLike }
  }
  return g.LanguageModel ?? g.ai?.languageModel ?? null
}

/**
 * Report whether the on-device model can be used:
 *  'unsupported'  — API not present in this browser
 *  'unavailable'  — present but model can't run here
 *  'downloadable' — supported, model not yet downloaded
 *  'downloading'  — model is downloading
 *  'available'    — ready to use
 */
export async function aiAvailability(): Promise<string> {
  const lm = getLanguageModel()
  if (!lm) return 'unsupported'
  try {
    return await lm.availability()
  } catch {
    return 'unavailable'
  }
}

/**
 * Create a model session. Asks for greedy decoding (topK 1) so the same page
 * gets the same answer; builds that reject sampling params fall back to
 * defaults.
 */
async function createSession(
  lm: LanguageModelLike,
  monitor?: (m: EventTarget) => void,
): Promise<AiSession> {
  const base = {
    initialPrompts: [{ role: 'system', content: AI_SYSTEM_PROMPT }],
    ...(monitor ? { monitor } : {}),
  }
  try {
    return await lm.create({ ...base, temperature: 0, topK: 1 })
  } catch {
    return await lm.create(base)
  }
}

async function ensureAiSession(): Promise<AiSession | null> {
  if (aiSession) return aiSession
  const lm = getLanguageModel()
  if (!lm) return null
  try {
    const status = await lm.availability()
    if (status !== 'available' && status !== 'downloadable') return null
    aiSession = await createSession(lm)
    return aiSession
  } catch {
    aiSession = null
    return null
  }
}

/**
 * Proactively warm up the on-device model. If it still needs downloading, this
 * starts the download (Gemini Nano is a few-hundred-MB one-time fetch) and
 * streams progress through onProgress so the Settings UI can show a bar. This
 * cannot run unless the Prompt API is present — it never flips a browser flag.
 */
export async function prepareAiModel(
  onProgress: (p: AiProgress) => void,
): Promise<void> {
  const lm = getLanguageModel()
  if (!lm) {
    onProgress({ state: 'unavailable', progress: 0 })
    return
  }
  try {
    const status = await lm.availability()
    if (status === 'unavailable') {
      onProgress({ state: 'unavailable', progress: 0 })
      return
    }
    if (status === 'available') {
      await ensureAiSession()
      onProgress({ state: 'ready', progress: 1 })
      return
    }
    // 'downloadable' / 'downloading' — create with a monitor to track the fetch.
    onProgress({ state: 'downloading', progress: 0 })
    aiSession = await createSession(lm, (m) => {
      m.addEventListener('downloadprogress', (e) => {
        const loaded = (e as unknown as { loaded: number }).loaded ?? 0
        onProgress({ state: 'downloading', progress: loaded })
      })
    })
    onProgress({ state: 'ready', progress: 1 })
  } catch {
    aiSession = null
    onProgress({ state: 'unavailable', progress: 0 })
  }
}

function aiCacheKey(input: { domain: string; title: string }): string {
  return `${input.domain}|${input.title.trim().toLowerCase()}`
}

async function readAiCache(): Promise<Record<string, IntentId>> {
  const r = await chrome.storage.local.get(AI_CACHE_KEY)
  return (r[AI_CACHE_KEY] as Record<string, IntentId> | undefined) ?? {}
}

async function writeAiCache(key: string, intent: IntentId): Promise<void> {
  const cache = await readAiCache()
  delete cache[key] // re-insert so it becomes the newest entry
  cache[key] = intent
  const keys = Object.keys(cache)
  // Insertion order is preserved, so the first keys are the oldest.
  for (const k of keys.slice(0, Math.max(0, keys.length - AI_CACHE_MAX))) {
    delete cache[k]
  }
  await chrome.storage.local.set({ [AI_CACHE_KEY]: cache })
}

/**
 * Ask Gemini Nano for an intent. Returns null on any failure (caller falls
 * back). Answers are cached per domain + title so a page keeps one label, and
 * each prompt runs on a fresh clone of the base session so earlier pages never
 * leak into the conversation context.
 */
async function classifyByAI(input: {
  domain: string
  title: string
}): Promise<ClassifyResult | null> {
  const key = aiCacheKey(input)
  const cached = (await readAiCache())[key]
  if (cached) return { intent: cached, confidence: AI_CONFIDENCE, source: 'ai' }

  const base = await ensureAiSession()
  if (!base) return null
  let session: AiSession | null = null
  try {
    session = base.clone ? await base.clone() : base
    const raw = await session.prompt(
      `Domain: ${input.domain}\nTitle: ${input.title}`,
    )
    const word = raw
      .trim()
      .toLowerCase()
      .split(/[^a-z]+/)[0] as IntentId
    if (INTENT_IDS.includes(word)) {
      await writeAiCache(key, word)
      return { intent: word, confidence: AI_CONFIDENCE, source: 'ai' }
    }
  } catch {
    aiSession = null // drop a poisoned handle so the next call recreates it
  } finally {
    if (session && session !== base) session.destroy?.()
  }
  return null
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

/**
 * Classify a page. Runs rules first (instant). If AI is enabled and the rule
 * guess is shaky, asks Gemini Nano to refine — but never blocks the result on
 * it: any AI failure falls back to the rule answer.
 */
/**
 * Non-blocking variant for live views: rules, upgraded to a previously cached
 * AI answer when one exists, but never prompts the model. Keeps the live
 * "today" numbers in agreement with how the session will be finalized.
 */
export async function classifyQuick(
  input: { domain: string; url: string; title: string },
  aiEnabled: boolean,
): Promise<ClassifyResult> {
  const rule = classifyByRules(input)
  if (!aiEnabled || rule.confidence >= AI_REFINE_BELOW) return rule
  const cached = (await readAiCache())[aiCacheKey(input)]
  return cached
    ? { intent: cached, confidence: AI_CONFIDENCE, source: 'ai' }
    : rule
}

export async function classify(
  input: { domain: string; url: string; title: string },
  aiEnabled: boolean,
): Promise<ClassifyResult> {
  const rule = classifyByRules(input)
  if (!aiEnabled || rule.confidence >= AI_REFINE_BELOW) return rule
  const ai = await classifyByAI(input)
  return ai ?? rule
}
