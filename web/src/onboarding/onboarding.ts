/**
 * First-run tour flag + a way for Settings to replay it.
 *
 * The key is never demo-scoped: entering or leaving demo mode must not replay
 * the tour, and the tour itself is about the app, not the dataset.
 */
export const ONBOARDING_SEEN_KEY = 'toydairy.onboarding.seen'
export const ONBOARDING_EVENT = 'toydairy:onboarding'

export function hasSeenOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  } catch {
    // Private mode: the tour may reappear next launch, which is harmless.
  }
}

/** Settings → replay. AppLayout owns the single overlay instance. */
export function requestOnboarding(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ONBOARDING_EVENT))
}
