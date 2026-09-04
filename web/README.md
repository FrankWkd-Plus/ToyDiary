# Toy Diary · Web（前端）

React + TypeScript + Vite + Tailwind。业务数据默认 **localStorage**（`PERSISTENCE = 'localStorage'`，REST/D1 接口契约保留）；智能记录可走 Cloudflare Pages Function（密钥不在前端）。

更完整的仓库说明与 **部署流程** 见根目录 [`readme.md`](../readme.md) 与 [`docs/cloudflare.md`](../docs/cloudflare.md)。

## 启动

```bash
cd web
npm install
cp .env.example .env.local   # 可选
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。桌面端会居中约 390px 手机框。

## 可交互路径

| 操作 | 路径 |
|------|------|
| 玩偶档案 | 底栏「档案」 |
| 图片/文字智能记录 | 中间「+」 |
| 日记详情 / 重写 | 点进某条记录 |
| 玩偶成长时间轴 | 「成长」 |
| 玩偶记忆对话 | 「对话」 |
| 身份卡 / 切换玩偶 | 「档案」或「我的」 |
| 重置演示数据 | 「我的」 |

## 环境变量

见 [`.env.example`](./.env.example)：

| 变量 | 说明 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | AI 接口，默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 将来真 REST（仅 `PERSISTENCE = 'remote'` 时） |

**不要**把 OpenAI 等厂商 API Key 写进 `VITE_*`。

密钥在 **Cloudflare Pages → Settings → Environment variables**：

- `OPENAI_API_KEY`（Secret，必填）
- `OPENAI_BASE_URL`（可选）
- `OPENAI_MODEL`（可选）

服务端实现：[`functions/api/analyze-entry.ts`](./functions/api/analyze-entry.ts)。

## 部署（摘要）

```bash
cd web
npm ci && npm run build
npx wrangler pages deploy ./dist --project-name=toydairy --branch=main --commit-dirty=true
```

改完 Dashboard 机密后必须 **重新部署**。完整步骤见根 [`readme.md`](../readme.md#部署流程cloudflare-pages)。

## 脚本

- `npm run dev` — 开发
- `npm run build` — 类型检查 + 生产构建
- `npm run lint` — oxlint
- `npm run typecheck` — 仅 TS
- `npm run preview` — 预览 dist

## 目录

```
src/
  ai/         # analyzeEntry（前端调用 + 本地兜底）
  api/        # client + mockStore
  components/
  context/
  pages/
  types.ts
functions/
  api/analyze-entry.ts   # Pages Function（持有 OPENAI_* 机密）
public/
  _redirects             # SPA + /api 例外
```
