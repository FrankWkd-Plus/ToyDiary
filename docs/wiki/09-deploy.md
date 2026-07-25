# 09 · 部署与 Cloudflare

> 上级：[Wiki 首页](./README.md) · 原文：[`docs/cloudflare.md`](../cloudflare.md)

---

## Pages 项目

| 项 | 值 |
|----|-----|
| Project | **`toydiary`** |
| Production URL | https://toydiary.pages.dev |
| Production branch | `main` |
| Preview | non-`main` branches |
| 自定义域 | 默认可无；路演可能绑 `toydiary.outwardly.dpdns.org` |

> 拼写：仓库 **ToyDairy** / 域名 **toydiary** — 以 Cloudflare 项目名为准。

---

## 手动部署

```bash
cd web
npm ci
npm run build
# Pages Functions 与 dist 同根：web/
npx wrangler pages deploy ./dist \
  --project-name=toydiary \
  --branch=main \
  --commit-dirty=true
```

Preview：

```bash
npx wrangler pages deploy ./dist \
  --project-name=toydiary \
  --branch=feature/foo
```

### SPA 路由

`web/public/_redirects`：非 `/api/*` → `/index.html`；`/api/*` 留给 Functions。

---

## Secrets / 环境变量

**Pages → toydiary → Settings → Environment variables → Production**

| Variable | Type | Required | Meaning |
|----------|------|----------|---------|
| `OPENAI_API_KEY` | **Secret** | Yes | 上游 Key |
| `OPENAI_BASE_URL` | Text/Secret | No* | 须含 `/v1` |
| `OPENAI_MODEL` | Text | No* | 模型 id |
| `AI_PROVIDER` | Text | No | openai / anthropic / auto |

改 env 后必须 **重新部署** 或等 Functions 传播。

本地 Functions：`web/.dev.vars`（gitignored）：

```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://your-gateway.example/v1
OPENAI_MODEL=your-model-id
AI_PROVIDER=auto
```

前端公开（可进 `.env.local`）：

| 变量 | 含义 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | 默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 真 REST 基址（mock 关闭时） |

---

## 预留存储（已 provision）

配置：`web/wrangler.jsonc`

| Resource | Name / ID | Binding |
|----------|-----------|---------|
| KV | `TOYDAIRY_KV` / `f7455bde…` | `TOYDAIRY_KV` |
| D1 | `toydairy-db` / `6ccd35b5-…` | `DB` |
| R2 | `toydairy-media` | `MEDIA` |

当前前端仍 mock-first。

D1 迁移示例（未来）：

```bash
wrangler d1 execute toydairy-db --remote --file=./migrations/0001_init.sql
```

---

## 构建脚本

```bash
cd web
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm run build      # → dist
npm run preview
```

---

## 下一步

- [开发指南](./10-development.md)  
- [排障](./12-troubleshooting.md)  
