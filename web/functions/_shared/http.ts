/**
 * Tiny HTTP helpers shared by every Pages Function.
 *
 * The SPA is served from the same origin on the web, but the iOS shell runs
 * from `capacitor://localhost`, so every endpoint keeps permissive CORS.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...headers,
    },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
