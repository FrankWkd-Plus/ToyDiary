# Cloudflare deploy notes — Toy Dairy

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

## AI analyze endpoint (Pages Function)

| Item | Value |
|------|--------|
| Route | `POST /api/analyze-entry` |
| Source | `web/functions/api/analyze-entry.ts` |
| Frontend env | `VITE_AI_ANALYZE_ENDPOINT=/api/analyze-entry` (public) |

### Secrets (set only in Cloudflare Dashboard)

**Pages → toydiary → Settings → Environment variables → Production**

| Variable | Type | Required | Meaning |
|----------|------|----------|---------|
| `OPENAI_API_KEY` | **Secret / Encrypt** | Yes | Provider API key (must match the base URL provider) |
| `OPENAI_BASE_URL` | Text or Secret | No* | OpenAI-compatible base. If missing, code defaults to `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Text | No* | Model id. If missing, code defaults to `gpt-4o-mini` |

\* If you use a third-party gateway (DeepSeek / OpenRouter / 中转站 etc.), **both** `OPENAI_BASE_URL` and a matching `OPENAI_API_KEY` must be set on the **same** Pages project (`toydiary`) and **Production** environment. Plain text vars and secrets are separate lists — setting only the key is not enough.

Do **not** put the key in any `VITE_*` variable (Vite embeds those into the browser bundle).

After changing env vars, redeploy or trigger a new production deployment so Functions pick them up.

Local Function secrets (optional): create `web/.dev.vars` (gitignored):

```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://your-gateway.example/v1
OPENAI_MODEL=your-model-id
```

## Storage (provisioned)

| Resource | Name / ID | Binding (future Worker) |
|----------|-----------|-------------------------|
| KV | `TOYDAIRY_KV` / `f7455bde32684c789bc19a9e6eb01c63` | `TOYDAIRY_KV` |
| D1 | `toydairy-db` / `6ccd35b5-c08a-4eea-9e10-4a04dc577e99` | `DB` |
| R2 | `toydairy-media` | `MEDIA` |

Config: `web/wrangler.jsonc`

Current frontend still uses browser mock store (`USE_MOCK = true`). AI diary can still call `/api/analyze-entry` when the Function + secrets are configured.
