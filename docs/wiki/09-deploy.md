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

## AI 运行方式 / 环境变量

AI 不依赖任何 Key 或外部网关：`web/wrangler.jsonc` 声明了
`"ai": { "binding": "AI" }`，`/api/chat` 与 `/api/analyze-entry` 直接调用
`env.AI.run(...)`（Cloudflare Workers AI）。模型按 `AI_MODEL` → Qwen3 →
Llama 3.3 → Llama 3.1 的顺序自动降级。

**Pages → toydiary → Settings → Environment variables → Production**（均可选）：

| Variable | Type | Required | Meaning |
|----------|------|----------|---------|
| `AI_MODEL` | Text | No | 覆盖首个 Workers AI 模型 id（默认 `@cf/qwen/qwen3-30b-a3b-fp8`） |
| `ENVIRONMENT` | Text | No | `/api/health` 回显 |

旧的 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` / `AI_PROVIDER`
已不再读取，可从 Dashboard 删除。

改 env 或 `ai` binding 后必须 **重新部署** 或等 Functions 传播。

本地 Functions：`npx wrangler pages dev ./dist` 会自动模拟 `AI` binding，
访问 `/api/health` 可确认 `ai.binding === true`。

前端公开（可进 `.env.local`）：

| 变量 | 含义 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | 默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 真 REST 基址（mock 关闭时） |

---

## 存储（数据库资源 · 设计保留）

| Resource | Name / ID | Binding | 演示 | 设计文档 |
|----------|-----------|---------|------|----------|
| **D1** | `toydairy-db` / `6ccd35b5-…` | `DB` | 不写入 | [13-database](./13-database.md) |
| **KV** | `TOYDAIRY_KV` / `f7455bde…` | `TOYDAIRY_KV` | 不写入 | 同上 |
| **R2** | `toydairy-media` | `MEDIA` | 不写入 | R2 key 约定见 13 |

配置：`web/wrangler.jsonc` · Schema：`web/migrations/0001_init.sql` · 代码契约：`web/src/api/contracts.ts`

**演示**：`PERSISTENCE = 'localStorage'`，主库 dump = `toydairy.mock.v3`。  
**接口与表结构不删**；接真库时执行 migration + 换 Repository 实现。

```bash
# 仅在接真后端时执行（演示勿跑也可）
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
