# 02 · 架构

> 上级：[Wiki 首页](./README.md) · 全文：[`docs/tech.md`](../tech.md)

---

## 总览

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ UI Pages     │  │ mockStore   │  │ Local AI       │  │
│  │ + Context    │◄─┤ localStorage│  │ 抠图 / OCR     │  │
│  └──────┬───────┘  └─────────────┘  └────────────────┘  │
│         │ fetch /api/*                                   │
└─────────┼───────────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages · project: toydiary                   │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Static dist/        │  │ Pages Functions          │  │
│  │ (Vite build)        │  │ /api/chat                │  │
│  │                     │  │ /api/analyze-entry       │  │
│  │                     │  │ /api/places/*            │  │
│  └─────────────────────┘  └───────────┬──────────────┘  │
└───────────────────────────────────────┼─────────────────┘
                                        ▼
                     OpenAI-compatible / Anthropic gateway
                     Nominatim (OSM geocoding)
                     (预留) D1 / KV / R2
```

### 原则

| 原则 | 说明 |
|------|------|
| **密钥只在 Functions** | `OPENAI_*` 永不进 `VITE_*` |
| **CRUD 默认 mock** | 演示不依赖真库；KV/D1/R2 已在 `wrangler.jsonc` 预留 |
| **重模块懒加载** | Leaflet、抠图 ONNX 不进冷启动主包 |

---

## 技术栈

### 前端

| 层 | 选型 |
|----|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4（`@import 'tailwindcss'` + `@theme`） |
| 路由 | react-router-dom 7 |
| 图标 | lucide-react |
| 地图 | leaflet + react-leaflet + OSM |
| OCR | tesseract.js |
| 抠图 | `@imgly/background-removal` + `onnxruntime-web`（AGPL，演示用） |
| Lint | oxlint |

### 后端（轻量）

| 层 | 选型 |
|----|------|
| 运行时 | Cloudflare Pages Functions（`web/functions`） |
| AI 适配 | `functions/_shared/aiProvider.ts` |
| 地理 | Nominatim 服务端代理 |
| 配置 | `web/wrangler.jsonc` |
| 未来存储 | D1 / KV / R2 bindings 已声明，业务未接 |

---

## 关键目录

```
web/
├── functions/
│   ├── _shared/aiProvider.ts
│   └── api/
│       ├── chat.ts
│       ├── analyze-entry.ts
│       └── places/{search,reverse}.ts
├── public/                 # 静态图、_redirects、toy-cards
├── migrations/0001_init.sql
├── src/
│   ├── App.tsx · main.tsx · types.ts · index.css
│   ├── pages/              # TimelinePage = 档案 Home
│   ├── components/         # ToyCard · BottomNav · PlacePicker…
│   ├── layout/AppLayout.tsx
│   ├── context/AppContext.tsx
│   ├── api/                # client + mockStore + communityStore
│   ├── ai/                 # 前端 AI 客户端 + 本地 fallback
│   ├── auth/ · theme/ · places/ · image/ · ocr/
│   ├── archive/ · conversation/ · daysmatter/ · share/
│   └── profile/
├── package.json · vite.config.ts · wrangler.jsonc
```

---

## 运行时分层

| 层 | 职责 | 关键文件 |
|----|------|----------|
| **Shell** | 手机框、底栏、全局 loading、nudge | `AppLayout` · `BottomNav` · `ToyNudgeHost` |
| **Session** | 登录 / 游客 / 需登录门禁 | `AuthContext` · `RequireSession` · `RequireLogin` |
| **State** | toys / entries / currentToy / toast | `AppContext` |
| **Data** | Mock CRUD 或未来 REST | `api/client.ts` · `mockStore.ts` |
| **AI client** | 调 Functions + 本地模板 | `ai/*` |
| **Functions** | 持密钥调上游 | `functions/api/*` |

---

## 数据流（三条主链）

### 1. 记一笔 → 双视角

```
RecordMethodSheet → ComposePage
  → analyzeEntry() → POST /api/analyze-entry
  → 失败：generateLocalAnalysis
  → api.createEntry(+ place) → mockStore localStorage
  → 出现在成长轴 / 档案统计
```

### 2. 对话

```
ConversationPage
  → chatToyReply() → POST /api/chat
  → 失败：localPersonaReply + 错误气泡
  → chatStorage 按 toyId 持久化
```

### 3. 地点 / 地图

```
PlacePicker → placeService
  → /api/places/* → Nominatim → seed 降级
  → Entry.place
TravelMapPage → api.getTravelMap → Leaflet markers + Polyline
```

---

## 预留云资源

| 资源 | Binding | 规划用途 |
|------|---------|----------|
| D1 `toydairy-db` | `DB` | toys / entries |
| KV `TOYDAIRY_KV` | `TOYDAIRY_KV` | 缓存 / 会话 |
| R2 `toydairy-media` | `MEDIA` | 头像与日记图 |

当前：`USE_MOCK = true`，业务不读这些 binding。

---

## 下一步

- [Home UI](./03-home-ui.md)  
- [前端路由](./04-frontend.md)  
- [API](./07-api.md)  
- [部署](./09-deploy.md)  
