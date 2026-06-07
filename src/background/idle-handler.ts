import { MAX_IDLE_THRESHOLD_SEC, MIN_IDLE_THRESHOLD_SEC } from '@/lib/constants'
import { getSettings } from './storage'

/**
 * Configure chrome.idle's detection interval from user settings.
 * Chrome clamps the interval to >= 15s; we clamp again defensively.
 */
export async function applyIdleThreshold(): Promise<void> {
  const { idleThresholdSec } = await getSettings()
  const seconds = Math.min(
    MAX_IDLE_THRESHOLD_SEC,
    Math.max(MIN_IDLE_THRESHOLD_SEC, idleThresholdSec),
  )
  chrome.idle.setDetectionInterval(seconds)
}
