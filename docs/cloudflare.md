# Cloudflare deploy notes — Toy Dairy

## Pages (frontend)

| Item | Value |
|------|--------|
| Project | `toydairy` |
| Production URL | https://toydairy.pages.dev |
| Production branch | `main` |
| Preview deploys | non-`main` branches (via Git integration or `wrangler pages deploy --branch <name>`) |
| Custom domain | none (default `*.pages.dev` only) |

### Deploy static build (manual)

```bash
cd web
npm ci
npm run build
# Pages Functions live in web/functions — deploy with project root = web/
npx wrangler pages deploy ./dist --project-name=toydairy --branch=main --commit-dirty=true
```

Preview branch:

```bash
npx wrangler pages deploy ./dist --project-name=toydairy --branch=feature/foo
```

### SPA routing

`web/public/_redirects` rewrites non-API paths to `/index.html`, and leaves `/api/*` for Functions.

## AI analyze endpoint (Pages Function)

| Item | Value |
|------|--------|
| Route | `POST /api/analyze-entry` |
| Source | `web/functions/api/analyze-entry.ts` |
| Frontend env | `VITE_AI_ANALYZE_ENDPOINT=/api/analyze-entry` (public) |

### Secrets (set only in Cloudflare Dashboard)

**Pages → toydairy → Settings → Environment variables**

| Variable | Type | Required | Meaning |
|----------|------|----------|---------|
| `OPENAI_API_KEY` | **Secret / Encrypt** | Yes | Provider API key |
| `OPENAI_BASE_URL` | Text or Secret | No | OpenAI-compatible base, default `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Text | No | Default `gpt-4o-mini` |

Do **not** put the key in any `VITE_*` variable (Vite embeds those into the browser bundle).

Local Function secrets (optional): create `web/.dev.vars` (gitignored):

```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## Storage (provisioned)

| Resource | Name / ID | Binding (future Worker) |
|----------|-----------|-------------------------|
| KV | `TOYDAIRY_KV` / `f7455bde32684c789bc19a9e6eb01c63` | `TOYDAIRY_KV` |
| D1 | `toydairy-db` / `6ccd35b5-c08a-4eea-9e10-4a04dc577e99` | `DB` |
| R2 | `toydairy-media` | `MEDIA` |

Config: `web/wrangler.jsonc`

Current frontend still uses browser mock store (`USE_MOCK = true`). AI diary can still call `/api/analyze-entry` when the Function + secrets are configured.
