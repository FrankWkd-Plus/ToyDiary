# Cloudflare deploy notes — Toy Dairy

> 完整 API 见 [`api.md`](./api.md)；架构与模块见 [`tech.md`](./tech.md)。

## Pages (frontend)

| Item | Value |
|------|--------|
| Project | `toydiary` |
| Production URL | https://toydiary.pages.dev |
| Production branch | `main` |
| Preview deploys | non-`main` branches (via Git integration or `wrangler pages deploy --branch <name>`) |
| Custom domain | none (default `*.pages.dev` only) |

### Deploy static build (manual)

```bash
cd web
npm ci
npm run build
# Pages Functions live in web/functions — deploy with project root = web/
npx wrangler pages deploy ./dist --project-name=toydiary --branch=main --commit-dirty=true
```

Preview branch:

```bash
npx wrangler pages deploy ./dist --project-name=toydiary --branch=feature/foo
```

### SPA routing

`web/public/_redirects` rewrites non-API paths to `/index.html`, and leaves `/api/*` for Functions.

## AI endpoints (Pages Functions, Workers AI)

| Item | Value |
|------|--------|
| Routes | `POST /api/chat` · `POST /api/analyze-entry` · `GET /api/health` |
| Source | `web/functions/api/{chat,analyze-entry,health}.ts` |
| Runtime | Cloudflare Workers AI via the `AI` binding in `web/wrangler.jsonc` |
| Frontend env | `VITE_AI_ANALYZE_ENDPOINT=/api/analyze-entry` (public) |

No API key, gateway or external server is involved: the Functions call
`env.AI.run(...)` directly on Cloudflare's edge. Models are tried in order and
fall back automatically (`AI_MODEL` → Qwen3 → Llama 3.3 → Llama 3.1).

### Optional variables (Pages → toydiary → Settings → Environment variables)

| Variable | Type | Required | Meaning |
|----------|------|----------|---------|
| `AI_MODEL` | Text | No | Pin the first Workers AI model id. Default `@cf/qwen/qwen3-30b-a3b-fp8` |
| `ENVIRONMENT` | Text | No | Echoed by `/api/health` |

The legacy `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` / `AI_PROVIDER`
variables are no longer read and can be deleted.

After changing env vars or the `ai` binding, redeploy so Functions pick them up.

Local checks: open `http://localhost:8788/api/health` with
`npx wrangler pages dev ./dist` (the AI binding is emulated locally).

## Places endpoints (Pages Functions, edge cache)

| Item | Value |
|------|--------|
| Routes | `GET/POST /api/places/search` · `GET /api/places/reverse` |
| Upstream | Nominatim (primary, serialized to 1 req/s) → Photon (keyless fallback) |
| Cache | `caches.default`: 7 days for search, 30 days for reverse |

No key or server is required; responses carry `Cache-Control` and are stored at
the Cloudflare edge.

## Storage (provisioned)

| Resource | Name / ID | Binding (future Worker) |
|----------|-----------|-------------------------|
| KV | `TOYDAIRY_KV` / `f7455bde32684c789bc19a9e6eb01c63` | `TOYDAIRY_KV` |
| D1 | `toydairy-db` / `6ccd35b5-c08a-4eea-9e10-4a04dc577e99` | `DB` |
| R2 | `toydairy-media` | `MEDIA` |

Config: `web/wrangler.jsonc`

Current frontend persists **all demo CRUD to localStorage** (`PERSISTENCE = 'localStorage'` in `web/src/api/client.ts`).  
REST/D1 contracts are kept in code (`api/contracts.ts`, `migrations/0001_init.sql`) but **not written at runtime**.  
AI diary / chat / places still call Pages Functions when configured.
