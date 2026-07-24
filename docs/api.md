# Toy Dairy API 文档

> 线上站点：`https://toydiary.pages.dev`  
> 实现位置：`web/functions/api/*`（Cloudflare Pages Functions）  
> 前端数据层：`web/src/api/client.ts`（默认 `USE_MOCK = true`，玩偶/日记走 localStorage）

本文档覆盖：

1. **真实 HTTP API**（Pages Functions，可部署后直接调用）
2. **Mock / 本地数据契约**（`api.*` 与 REST 对齐，便于日后替换后端）

所有 JSON 响应均为 `Content-Type: application/json; charset=utf-8`。  
CORS：`Access-Control-Allow-Origin: *`（Functions 层）。

---

## 1. 总览

| 方法 | 路径 | 类型 | 说明 |
|------|------|------|------|
| `POST` | `/api/chat` | Function | 玩偶对话（OpenAI / Anthropic 兼容） |
| `OPTIONS` | `/api/chat` | Function | CORS 预检 |
| `POST` | `/api/analyze-entry` | Function | 生成双视角日记 JSON |
| `OPTIONS` | `/api/analyze-entry` | Function | CORS 预检 |
| `GET` | `/api/places/search?q=` | Function | 地点搜索（Nominatim 代理） |
| `POST` | `/api/places/search` | Function | 同上（body: `{ q, limit? }`） |
| `GET` | `/api/places/reverse?lat=&lon=` | Function | 逆地理编码 |
| — | Mock `api.listToys` 等 | 浏览器 | 见第 6 节（非 HTTP） |

**环境变量（仅 Dashboard / `.dev.vars`，不要写进 `VITE_*`）：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是* | 上游 API Key（OpenAI 兼容网关 / Anthropic 网关通用） |
| `OPENAI_BASE_URL` | 否 | 例如 `https://api.openai.com/v1` 或中转 `https://xxx/v1` |
| `OPENAI_MODEL` | 否 | 模型 id |
| `AI_PROVIDER` | 否 | `openai` \| `anthropic` \| `auto`（默认 auto） |

\* 地点接口不需要 AI Key。

---

## 2. `POST /api/chat`

玩偶对话。前端：`web/src/ai/chatToyReply.ts`。

### Request

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "message": "今天有点累",
  "quietMode": false,
  "toy": {
    "name": "小熊 Luna",
    "role": "旅行搭子",
    "traits": ["温柔", "好奇"],
    "bio": "…",
    "monologue": "…"
  },
  "history": [
    { "role": "user", "text": "你好" },
    { "role": "toy", "text": "我在呀" }
  ],
  "memories": [
    {
      "title": "海风吹过的下午",
      "location": "蓝色海湾",
      "date": "2026-07-23",
      "note": "第一次一起坐船"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 用户本轮消息 |
| `toy` | object | 否 | 人格上下文 |
| `history` | `{role,text}[]` | 否 | 最近对话，最多用 12 条 |
| `memories` | object[] | 否 | 共同记忆摘要，最多 6 条 |
| `quietMode` | boolean | 否 | 安静模式：更短、少追问 |

`history.role`：`user` \| `toy` \| `assistant`（`toy`/`assistant` 都会映射为模型 assistant）。

### Success `200`

```json
{
  "reply": "先休息一下吧，我陪着你。",
  "source": "api",
  "auth": {
    "envKey": "OPENAI_API_KEY",
    "provider": "openai",
    "providerSource": "default",
    "baseUrl": "https://…/v1",
    "model": "…",
    "baseUrlSource": "env:OPENAI_BASE_URL",
    "modelSource": "env:OPENAI_MODEL",
    "endpoint": "https://…/v1/chat/completions",
    "keyConfigured": true,
    "keyHint": "sk-K…z2Kr (len 51)"
  }
}
```

### Errors

| HTTP | `error` 示例 | 含义 |
|------|----------------|------|
| `400` | `message is required` / `Invalid JSON body` | 请求体问题 |
| `500` | `OPENAI_API_KEY is not configured…` | 未配置密钥 |
| `502` | `AI provider HTTP 401` / `Invalid AI provider response` / `Empty AI response` / `Failed to reach AI provider` | 上游失败 |

失败体常带：

```json
{
  "error": "AI provider HTTP 401",
  "detail": "…上游原始正文片段…",
  "auth": { "…": "…" },
  "hint": "可选修复提示"
}
```

`auth.keyHint` **不会**返回完整 key，仅前后缀 + 长度。

### 协议说明

- `AI_PROVIDER=auto`：按 base URL / 模型名判断 OpenAI `chat/completions` 或 Anthropic `messages`；自定义网关 OpenAI 失败时会再试 Anthropic。
- Anthropic：system 独立字段；header 带 `x-api-key` + `Authorization` + `anthropic-version`。
- 前端失败时会本地模板回退，并在对话里展示 API 错误气泡。

---

## 3. `POST /api/analyze-entry`

根据玩偶人格 + 日期/地点/备注/可选照片，生成日记 JSON。  
前端：`web/src/ai/analyzeEntry.ts`。

### Request

```json
{
  "date": "2026-07-24",
  "location": "上海 · 武康路",
  "userNote": "今天带熊看日落",
  "imageDataUrl": "data:image/jpeg;base64,…",
  "toy": {
    "name": "小熊 Luna",
    "role": "旅行搭子",
    "traits": ["温柔"],
    "bio": "…",
    "monologue": "…"
  }
}
```

| 字段 | 类型 | 必填 |
|------|------|------|
| `toy` | object | 否（有默认） |
| `date` | string | 否（默认当天） |
| `location` | string | 否 |
| `userNote` | string | 否 |
| `imageDataUrl` | string | 否（`data:image/…` 时以多模态传入） |

### Success `200`

```json
{
  "title": "把日落装进口袋",
  "aiDiary": "……玩偶第一人称……",
  "toyReply": "我已经把这一刻写下来啦…",
  "mood": "温柔",
  "tags": ["日落", "日常"],
  "imageAnalysis": "……",
  "entryType": "daily",
  "auth": { "…": "…" }
}
```

| 字段 | 说明 |
|------|------|
| `title` | ≤ 约 20 字 |
| `aiDiary` | 玩偶第一人称，可含 `\n` |
| `toyReply` | 保存前对用户说的一句话 |
| `mood` | 心情词 |
| `tags` | 1–4 个标签 |
| `imageAnalysis` | 有图时的画面简述 |
| `entryType` | `travel` \| `daily` \| `memorial` \| `text` |

### Errors

与 chat 类似：`400` / `500` / `502`。  
额外可能：

- `AI response is not valid JSON`
- `AI response missing title or aiDiary`

OpenAI 路径会请求 `response_format: json_object`；Anthropic 路径依赖 system 提示约束 JSON。

前端在远程失败时会走 **本地模板** `generateLocalAnalysis`，保证演示不断。

---

## 4. 地点 API

### 4.1 `GET /api/places/search`

```http
GET /api/places/search?q=大理&limit=8
```

或：

```http
POST /api/places/search
Content-Type: application/json

{ "q": "大理", "limit": 8 }
```

**Success `200`**

```json
{
  "places": [
    {
      "country": "中国",
      "region": "云南省",
      "city": "大理市",
      "district": null,
      "poi": null,
      "displayName": "大理市, 云南省, 中国",
      "lat": 25.6065,
      "lng": 100.2676,
      "providerPlaceId": "123",
      "provider": "nominatim"
    }
  ]
}
```

**Error**

- `400`：`q is required`
- `502`：Nominatim 不可达 / 非 2xx

### 4.2 `GET /api/places/reverse`

```http
GET /api/places/reverse?lat=31.2304&lon=121.4737
```

`lon` 与 `lng` 均可。

**Success `200`**

```json
{
  "place": {
    "displayName": "…",
    "lat": 31.2304,
    "lng": 121.4737,
    "country": "中国",
    "region": "上海市",
    "city": "上海市",
    "provider": "nominatim",
    "providerPlaceId": "…"
  }
}
```

上游：OpenStreetMap **Nominatim**（服务端代理，带 User-Agent）。请遵守 Nominatim 使用政策（搜索应按钮触发，勿逐字自动补全轰炸）。

前端 `placeService` 降级顺序：

1. Pages 代理  
2. 浏览器直连 Nominatim（可能被 CORS 拦）  
3. 本地 seed 地点目录  

---

## 5. 共享 Place 结构

前后端与 mock 统一：

```ts
interface Place {
  id?: string
  country?: string
  region?: string
  city?: string
  district?: string
  poi?: string
  displayName: string
  lat: number
  lng: number
  providerPlaceId?: string
  provider?: 'nominatim' | 'manual' | 'exif' | 'geolocation' | 'seed'
}
```

---

## 6. Mock / 未来 REST 契约（`api` 客户端）

文件：`web/src/api/client.ts` · 实现：`mockStore.ts`  
开关：`USE_MOCK = true`；关闭后需 `VITE_API_BASE`。

| 客户端方法 | 建议 REST | 说明 |
|------------|-----------|------|
| `listToys()` | `GET /toys` | 玩偶列表 |
| `getToy(id)` | `GET /toys/:id` | 单个玩偶 |
| `createToy(input)` | `POST /toys` | 创建玩偶（含 `avatarUrl`） |
| `generateProfile(id)` | `POST /toys/:id/generate-profile` | 重算星座/简介/独白 |
| `listEntries(toyId)` | `GET /toys/:toyId/entries` | 日志列表 |
| `getEntry(id)` | `GET /entries/:id` | 单条日志 |
| `createEntry(toyId, input)` | `POST /toys/:toyId/entries` | 创建日志（可含 `place`） |
| `regenerateEntry(id)` | `POST /entries/:id/regenerate` | 重写 AI 日记 |
| `getTravelMap(toyId)` | `GET /toys/:toyId/travel-map` | 旅行地图点位 |

### 6.1 CreateToyInput

```ts
{
  name: string
  birthDate: string        // YYYY-MM-DD
  birthPlace: string
  role: string
  traits: string[]
  bio?: string
  monologue?: string
  avatarUrl?: string       // MVP: Data URL；正式：对象存储 URL
  zodiac?: string
}
```

### 6.2 CreateEntryInput

```ts
{
  type: 'travel' | 'daily' | 'memorial' | 'text' | 'heart'
  date: string
  location?: string        // 展示用纯文本
  place?: Place            // 结构化地点（地图必需）
  title?: string
  userNote?: string
  mood?: string
  imageUrl?: string
  aiDiary?: string
  tags?: string[]
  imageAnalysis?: string
}
```

### 6.3 TravelMapResponse

```ts
{
  toyId: string
  points: Array<{
    entryId: string
    toyId: string
    date: string
    title?: string
    mood?: string
    imageUrl?: string
    aiDiary?: string
    userNote?: string
    place: Place
  }>
  years: number[]
  cityCount: number
  travelCount: number
}
```

Mock storage key：`toydairy.mock.v3`（localStorage）。

社区相关 `communityStore` 同样 mock-first，接口见 `client.ts` 后半段（点赞/关注/私信等），当前产品主路径已将社区入口重定向到对话。

---

## 7. 前端专用「非 HTTP」能力

这些在浏览器本地完成，**没有**对应 Pages Function：

| 能力 | 模块 | 说明 |
|------|------|------|
| 抠图 | `@imgly/background-removal` via `removeToyBackground.ts` | 首次下载 ONNX 模型 |
| 白边贴纸 | `createStickerAvatar.ts` | Canvas 512×512 PNG/WebP |
| OCR | `tesseract.js` | 拍照记录识别文字 |
| 对话缓存 | `localStorage` key `toydairy.conversations.v1` | 按玩偶分会话 |
| 安静模式 | `toydairy.quietMode` | boolean 字符串 |

---

## 8. 调用示例

### curl 对话

```bash
curl -sS https://toydiary.pages.dev/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"你好","toy":{"name":"Luna","role":"伙伴","traits":["温柔"]}}'
```

### curl 地点搜索

```bash
curl -sS 'https://toydiary.pages.dev/api/places/search?q=%E5%A4%A7%E7%90%86&limit=5'
```

### 浏览器前端（默认）

```ts
import { chatToyReply } from './ai/chatToyReply'
import { api } from './api/client'

const { reply, apiError } = await chatToyReply({ toy, message: '嗨' })
const map = await api.getTravelMap(toyId)
```

---

## 9. 错误与排障速查

| 现象 | 排查 |
|------|------|
| `baseUrl: api.openai.com` 但你以为配了中转 | Production 未设置 `OPENAI_BASE_URL`（plain text），或未重新部署 |
| 401 invalid_api_key | Key 与 base 不匹配（中转 key 打到了官方 OpenAI） |
| 返回 HTML（New API 首页） | `OPENAI_BASE_URL` 缺 `/v1` |
| Invalid AI provider response | 协议错（OpenAI vs Anthropic）；设 `AI_PROVIDER` |
| 地点搜不到 | 代理 502 / 网络；前端会落到 seed 目录 |
| 对话有错误气泡 | 预期：展示 API 返回，同时本地模板兜底回复 |

更完整的架构与模块说明见 [`docs/tech.md`](./tech.md)。
