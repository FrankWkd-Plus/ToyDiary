/**
 * GET /api/health — quick check that the Pages Functions environment is wired
 * correctly. Never returns secrets; only binding presence and model names.
 */

import { json, preflight } from '../_shared/http'
import type { PagesContext } from '../_shared/types'
import { aiModelCandidates, DEFAULT_AI_MODEL, type AiEnv } from '../_shared/workersAi'

type Env = AiEnv & {
  TOYDAIRY_KV?: unknown
  DB?: unknown
  MEDIA?: unknown
  ENVIRONMENT?: string
}

export async function onRequestOptions(): Promise<Response> {
  return preflight()
}

export async function onRequestGet(
  context: PagesContext<Env>,
): Promise<Response> {
  const { env } = context
  const models = aiModelCandidates(env)

  return json({
    ok: true,
    service: 'toydiary-pages-functions',
    environment: env.ENVIRONMENT ?? 'unknown',
    ai: {
      binding: Boolean(env.AI),
      mode: env.AI ? 'workers-ai' : 'unconfigured',
      model: models[0] ?? DEFAULT_AI_MODEL,
      fallbacks: models.slice(1),
    },
    bindings: {
      kv: Boolean(env.TOYDAIRY_KV),
      d1: Boolean(env.DB),
      r2: Boolean(env.MEDIA),
    },
    places: {
      primary: 'nominatim',
      fallback: 'photon',
      cache: 'cloudflare-edge',
    },
    time: new Date().toISOString(),
  })
}
