/**
 * Minimal structural types for Pages Functions.
 *
 * We do not depend on `@cloudflare/workers-types` so the functions can be
 * typechecked locally without pulling an extra package into the repo.
 */

export type PagesContext<Env> = {
  request: Request
  env: Env
  /** Pages always provides this; keep it optional for local harnesses. */
  waitUntil?: (promise: Promise<unknown>) => void
}
