/**
 * Demo mode namespace.
 *
 * Demo mode swaps the *business data* keys (toys/entries, chats, community,
 * drafts) for `.demo` variants so a walkthrough never touches the real
 * records. Appearance preferences (theme, locale, user prefs) stay shared.
 *
 * This module deliberately imports nothing: the stores import it, so it must
 * never import them back. Seeding / teardown lives in `demoActions.ts`.
 */

export const DEMO_FLAG_KEY = 'toydairy.demoMode'
export const DEMO_SUFFIX = '.demo'

/** Base keys that get a `.demo` twin. Kept here so teardown cannot drift. */
export const DEMO_SCOPED_BASE_KEYS = [
  'toydairy.mock.v3',
  'toydairy.community.v1',
  'toydairy.conversations.v1',
  'toydairy.quietMode',
] as const

/** Draft keys are `toydiary.draft.v1.<entry|toy>.<id>`, so they are enumerated. */
export const DRAFT_KEY_PREFIX = 'toydiary.draft.v1.'

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DEMO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function setDemoMode(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(DEMO_FLAG_KEY, '1')
    else window.localStorage.removeItem(DEMO_FLAG_KEY)
  } catch (error) {
    // Private mode / quota: keep the previous state rather than half-switch.
    console.error('[demoMode] could not write the demo flag', error)
  }
}

/**
 * Resolve a base key against the active namespace.
 * Call this at every read/write — never capture the result at module scope,
 * or toggling demo mode would leave that store pointing at the old key.
 */
export function demoScopedKey(baseKey: string): string {
  return isDemoMode() ? `${baseKey}${DEMO_SUFFIX}` : baseKey
}

/** Remove every `.demo` key (including demo drafts). Real keys are untouched. */
export function clearDemoNamespace(): void {
  if (typeof window === 'undefined') return
  const storage = window.localStorage
  try {
    for (const base of DEMO_SCOPED_BASE_KEYS) {
      storage.removeItem(`${base}${DEMO_SUFFIX}`)
    }
    const drafts: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (
        key &&
        key.startsWith(DRAFT_KEY_PREFIX) &&
        key.endsWith(DEMO_SUFFIX)
      ) {
        drafts.push(key)
      }
    }
    for (const key of drafts) storage.removeItem(key)
  } catch (error) {
    console.error('[demoMode] could not clear the demo namespace', error)
  }
}
