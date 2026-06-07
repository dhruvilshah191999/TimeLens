/**
 * Intent classification — Phase 2.
 *
 * Will implement a three-tier fallback:
 *   1. Chrome built-in Gemini Nano (window.ai.languageModel) — on-device.
 *   2. Groq API with the user's own key — only if they opt in.
 *   3. Keyword/domain rule classifier — always available, no network.
 *
 * Stubbed for Phase 1 so tracking has no dependency on classification.
 */

import type { Session } from '@/lib/types'

export async function classifySessions(_sessions: Session[]): Promise<void> {
  // Phase 2.
}
