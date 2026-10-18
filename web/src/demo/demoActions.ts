/**
 * Demo mode orchestration — the only module that seeds or tears down the demo
 * namespace. Kept out of `demoMode.ts` so the stores can import the flag
 * helpers without pulling the stores back in (no import cycle).
 *
 * Callers reload the page afterwards: providers are built at boot, exactly the
 * way the existing factory reset works (`MePage` → `location.assign`).
 */
import { communityStore } from '../api/communityStore'
import { mockStore } from '../api/mockStore'
import { clearDemoNamespace, setDemoMode } from './demoMode'
import { resetDemoChats } from './demoSeed'

/**
 * Enter demo mode with a *fresh* dataset every time: the previous demo space
 * is discarded, then toys, community and chats are re-seeded.
 */
export function activateDemoMode(): void {
  setDemoMode(true)
  clearDemoNamespace()
  mockStore.resetDemo()
  communityStore.reset()
  resetDemoChats()
}

/** Leave demo mode. Real keys were never touched; the demo space is dropped. */
export function deactivateDemoMode(): void {
  setDemoMode(false)
  clearDemoNamespace()
}
