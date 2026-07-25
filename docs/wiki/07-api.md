# 07 · API

> 上级：[Wiki 首页](./README.md) · 契约全文：[`docs/api.md`](../api.md)

线上：`https://toydiary.pages.dev` · 实现：`web/functions/api/*`  
前端数据层：`web/src/api/client.ts`（默认 `USE_MOCK = true`）

所有 JSON：`Content-Type: application/json; charset=utf-8`  
CORS：`Access-Control-Allow-Origin: *`（演示向）

---

## 真实 HTTP（Pages Functions）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 玩偶对话 |
| `OPTIONS` | `/api/chat` | CORS |
| `POST` | `/api/analyze-entry` | 双视角日记 JSON |
| `OPTIONS` | `/api/analyze-entry` | CORS |
| `GET`/`POST` | `/api/places/search` | 地点搜索 |
| `GET` | `/api/places/reverse` | 逆地理 `lat` + `lon`/`lng` |

### 环境变量（仅 Dashboard / `.dev.vars`，禁止 `VITE_*`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是* | 上游 Key |
| `OPENAI_BASE_URL` | 否 | 须含 `/v1` |
| `OPENAI_MODEL` | 否 | 模型 id |
| `AI_PROVIDER` | 否 | `openai` \| `anthropic` \| `auto` |

\* 地点接口不需要 AI Key。

---

## `POST /api/chat`（摘要）

**Body：** `message` · `toy?` · `history?` · `memories?` · `quietMode?`  

**200：** `{ reply, source, auth }`  

**错误：** `400` 体问题 · `500` 无 Key · `502` 上游失败（常带 `auth` 元数据、`keyHint` 非完整 key）

前端：`web/src/ai/chatToyReply.ts`；失败本地人格 + 错误气泡。

---

## `POST /api/analyze-entry`（摘要）

**Body：** `toy?` · `date?` · `location?` · `userNote?` · `imageDataUrl?`  

**200 字段：** `title` · `aiDiary` · `toyReply` · `mood` · `tags` · `imageAnalysis?` · `entryType` · `auth`

前端：`web/src/ai/analyzeEntry.ts`；失败 `generateLocalAnalysis`。

---

## 地点 API（摘要）

**搜索** `?q=&limit=` 或 POST `{ q, limit? }` → `{ places: Place[] }`  

**逆地理** `?lat=&lon=` → `{ place: Place }`  

上游：Nominatim（服务端代理 + User-Agent）。搜索须**按钮触发**，禁止逐字 autocomplete。

前端降级：Pages 代理 → 浏览器直连 → seed 目录。

---

## Mock / 未来 REST（`api` 客户端）

| 客户端方法 | 建议 REST |
|------------|-----------|
| `listToys` / `getToy` / `createToy` | `GET/POST /toys` · `GET /toys/:id` |
| `generateProfile` | `POST /toys/:id/generate-profile` |
| `listEntries` / `createEntry` | `GET/POST /toys/:toyId/entries` |
| `getEntry` / `regenerateEntry` | `GET /entries/:id` · `POST /entries/:id/regenerate` |
| `getTravelMap` | `GET /toys/:toyId/travel-map` |

存储 key：`toydairy.mock.v3`。

---

## 非 HTTP 本地能力

抠图 · 贴纸 Canvas · OCR · 对话 localStorage · 安静模式 — 见 [05-features](./05-features.md)。

---

## curl 自检

```bash
curl -sS https://toydiary.pages.dev/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"你好","toy":{"name":"Luna","role":"伙伴","traits":["温柔"]}}'

curl -sS 'https://toydiary.pages.dev/api/places/search?q=%E5%A4%A7%E7%90%86&limit=5'
```

---

## 下一步

- [AI 链路](./08-ai.md)  
- [排障](./12-troubleshooting.md)  
- 全文 → [`docs/api.md`](../api.md)  
