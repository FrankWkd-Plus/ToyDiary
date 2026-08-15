/**
 * Auth gates are disabled — the app always runs as a logged-in demo user.
 * Keep these wrappers so existing imports still work without redirects.
 */

export function RequireSession({ children }: { children: React.ReactNode }) {
  return children
}

export function RequireLogin({ children }: { children: React.ReactNode }) {
  return children
}
