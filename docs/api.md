# Toy Dairy API 文档

> 线上站点：`https://toydiary.pages.dev`  
> 实现位置：`web/functions/api/*`（Cloudflare Pages Functions）  
> 前端数据层：`web/src/api/client.ts`  
> **演示持久化：`PERSISTENCE = 'localStorage'`**（玩偶/日记/社区等 CRUD 只写浏览器；**接口契约保留**见 §6 与 `web/src/api/contracts.ts`）

本文档覆盖：

1. **真实 HTTP API**（Pages Functions：AI / 地点，可部署后直接调用）
2. **数据契约 + localStorage 实现**（`api.*` 方法与 REST 对齐；演示一律落盘 localStorage，不写 D1）

所有 JSON 响应均为 `Content-Type: application/json; charset=utf-8`。  
CORS：`Access-Control-Allow-Origin: *`（Functions 层）。

---

## 1. 总览

| 方法 | 路径 | 类型 | 说明 |
|------|------|------|------|
| `POST` | `/api/chat` | Function | 玩偶对话（Cloudflare Workers AI） |
| `OPTIONS` | `/api/chat` | Function | CORS 预检 |
| `POST` | `/api/analyze-entry` | Function | 生成双视角日记 JSON（Workers AI） |
| `OPTIONS` | `/api/analyze-entry` | Function | CORS 预检 |
| `GET` | `/api/health` | Function | binding / 模型自检 |
| `GET` | `/api/places/search?q=` | Function | 地点搜索（Nominatim → Photon） |
| `POST` | `/api/places/search` | Function | 同上（body: `{ q, limit? }`） |
| `GET` | `/api/places/reverse?lat=&lon=` | Function | 逆地理编码 |
| — | Mock `api.listToys` 等 | 浏览器 | 见第 6 节（非 HTTP） |

**环境变量（可选；AI 通过 binding 调用，无需 Key）：**

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_MODEL` | 否 | 覆盖首个 Workers AI 模型 id，默认 `@cf/qwen/qwen3-30b-a3b-fp8` |
| `ENVIRONMENT` | 否 | `/api/health` 回显 |

模型会按 `AI_MODEL` → Qwen3 → Llama 3.3 → Llama 3.1 自动降级。
旧的 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` / `AI_PROVIDER` 已不再读取。

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
    "provider": "workers-ai",
    "binding": "AI",
    "model": "@cf/qwen/qwen3-30b-a3b-fp8",
    "configured": true
  }
}
```

### Errors

| HTTP | `error` 示例 | 含义 |
|------|----------------|------|
| `400` | `message is required` / `Invalid JSON body` | 请求体问题 |
| `503` | `Workers AI binding (AI) is not configured` | 未声明 `ai` binding |
| `502` | `Workers AI request failed` / `Empty AI response` | 所有候选模型均失败 |

失败体常带：

```json
{
  "error": "Workers AI request failed",
  "detail": "…最后一次失败的模型与原因…",
  "triedModels": ["@cf/qwen/qwen3-30b-a3b-fp8", "…"],
  "auth": { "provider": "workers-ai", "binding": "AI", "configured": true },
  "hint": "可选修复提示"
}
```

### 协议说明

- Function 直接调用 `env.AI.run(model, { messages })`，无需任何密钥或网关。
- 模型响应兼容 `{ response }`、OpenAI 风格 `choices[].message.content` 等形状；
  `<think>` 推理块会被剥离，不返回给用户。
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
  "hasPhoto": true,
  "imageToneDescription": "照片整体偏暖，夕阳的黄橙色调",
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
| `hasPhoto` | boolean | 否 |
| `imageToneDescription` | string | 否（本地 OCR/色调分析得到的氛围提示） |

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
  "auth": {
    "provider": "workers-ai",
    "binding": "AI",
    "model": "@cf/qwen/qwen3-30b-a3b-fp8",
    "configured": true
  }
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

与 chat 类似：`400` / `503` / `502`。  
额外可能：

- `AI response is not valid JSON`（已自动尝试一次 JSON 修复仍失败）
- `AI response missing title or aiDiary`

Workers AI 没有强制的 `response_format`，因此 Function 会从代码围栏 / 正文中提取 JSON，
并在解析失败时再发一次「改成合法 JSON」的修复请求。

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
      "displayName": "大理市",
      "lat": 25.6065,
      "lng": 100.2676,
      "providerPlaceId": "123",
      "provider": "nominatim"
    }
  ],
  "provider": "nominatim",
  "cached": false
}
```

`displayName` 由 `POI · 区 · 市` 三级拼成（缺项自动跳过；全缺时退回省/原始地址）。

**Error**

- `400`：`q is required`
- `502`：Nominatim 与 Photon 均不可达 / 无非空结果（`places: []`）

成功结果会写入 Cloudflare 边缘缓存（`caches.default`，7 天）；命中时返回 `"cached": true`。

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
  },
  "cached": false
}
```

上游：OpenStreetMap **Nominatim**（服务端代理，带 User-Agent，同一 isolate 内串行到
1 req/s），失败时回退 **Photon**（无需 Key）。结果边缘缓存 30 天。
请遵守 Nominatim 使用政策（搜索应按钮触发，勿逐字自动补全轰炸）。

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

## 6. 数据契约 + 数据库（`api` 客户端）

| 文件 | 职责 |
|------|------|
| `web/src/api/contracts.ts` | **数据库契约**：REST 路径、`ToyDairyRepository`、D1 `ToyRow`/`EntryRow`、mapper、R2 key、资源 ID |
| `web/src/api/client.ts` | 对外 `api.*`；`PERSISTENCE = 'localStorage'` 时用演示库实现 |
| `web/src/api/mockStore.ts` | **演示库驱动**：localStorage key `toydairy.mock.v3`（≡ toys+entries dump） |
| `web/migrations/0001_init.sql` | **D1 权威 schema**（演示不执行 SQL） |
| `docs/wiki/13-database.md` | Wiki：ER、表、映射、接库清单 |

开关：`PERSISTENCE = 'localStorage' | 'remote'`（`client.ts`）。  
演示/路演务必保持 **`localStorage`**（接口与表设计仍完整）。仅在有真后端且设置 `VITE_API_BASE` 时才改为 `remote`。  
兼容别名：`USE_MOCK === (PERSISTENCE === 'localStorage')`。

**逻辑表：** `toys` · `entries`（详见 migration / Wiki 13）。  
**演示存储 key：** `toydairy.mock.v3`。写操作均 `localStorage.setItem`；配额满会抛中文错误。

社区 `communityStore` 同样 localStorage（`toydairy.community.v1`）；产品入口已导向对话。

| 客户端方法 | 建议 REST | 说明 |
|------------|-----------|------|
| `listToys()` | `GET /toys` | 玩偶列表 |
| `getToy(id)` | `GET /toys/:id` | 单个玩偶 |
| `createToy(input)` | `POST /toys` | 创建玩偶（含 `avatarUrl`） |
| `generateProfile(id)` | `POST /toys/:id/generate-profile` | 重算星座/简介/独白 |
| `listEntries(toyId)` | `GET /toys/:toyId/entries` | 日志列表 |
| `getEntry(id)` | `GET /entries/:id` | 单条日志 |
| `createEntry(toyId, input)` | `POST /toys/:toyId/entries` | 创建日志（可含 `place`） |
| `updateEntry(id, patch)` | `PATCH /entries/:id` | 更新日记字段 |
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

逻辑表与 D1 列映射见 Wiki [13-database](./wiki/13-database.md)。社区接口见 `client.ts` 后半段。

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
| `/api/health` 显示 `ai.binding: false` | `wrangler.jsonc` 未部署 / `ai` binding 没生效；重新部署 |
| `Workers AI request failed` | 所有候选模型都失败；看 `detail` 与 `triedModels`，可用 `AI_MODEL` 换模型 |
| 回复里出现推理内容 | 不应发生：`<think>` 块会被剥离；若仍出现请记录模型 id |
| 地点搜不到 | 代理 502 / 上游限流；前端会落地 Nominatim 直连与 seed 目录 |
| 对话有错误气泡 | 预期：展示 API 返回，同时本地模板兜底回复 |

更完整的架构与模块说明见 [`docs/tech.md`](./tech.md)。
