# Toy Dairy 技术说明（前后端）

> 仓库：`FrankWkd-Plus/ToyDiary`  
> 生产：Cloudflare Pages 项目 **`toydiary`** → https://toydiary.pages.dev  
> 本文描述当前实现的技术栈、目录、数据流、部署与已知限制。

API 契约详见 [`docs/api.md`](./api.md)。

---

## 1. 架构一览

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
│  Cloudflare Pages                                       │
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
```

**原则：**

- **密钥只在 Functions**：`OPENAI_*` 永不进 `VITE_*`。
- **CRUD 默认 mock**：黑客松可演示；KV/D1/R2 已在 `wrangler.jsonc` 预留。
- **重模块懒加载**：地图 Leaflet、抠图 ONNX 不进冷启动主包。

---

## 2. 技术栈

### 前端

| 层 | 选型 |
|----|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4（`@import 'tailwindcss'` + `@theme`） |
| 路由 | react-router-dom 7 |
| 图标 | lucide-react |
| 地图 | leaflet + react-leaflet + OSM tiles |
| OCR | tesseract.js |
| 抠图 | `@imgly/background-removal` + `onnxruntime-web`（AGPL，演示用） |
| Lint | oxlint |

### 后端（轻量）

| 层 | 选型 |
|----|------|
| 运行时 | Cloudflare Pages Functions（`web/functions`） |
| AI 适配 | `functions/_shared/aiProvider.ts`（OpenAI + Anthropic 自动识别） |
| 地理 | Nominatim 服务端代理 |
| 配置 | `web/wrangler.jsonc` |
| 未来存储 | D1 / KV / R2 bindings 已声明，业务未接 |

### 脚本

```bash
cd web
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run lint
npm run build        # → web/dist
npm run preview
```

---

## 3. 仓库结构

```
ToyDairy/
├── docs/
│   ├── api.md              # API 文档
│   ├── tech.md             # 本文
│   ├── cloudflare.md       # 部署与环境变量
│   └── PRD.md
├── web/
│   ├── functions/
│   │   ├── _shared/aiProvider.ts
│   │   └── api/
│   │       ├── chat.ts
│   │       ├── analyze-entry.ts
│   │       └── places/{search,reverse}.ts
│   ├── public/             # 静态图、_redirects
│   ├── src/
│   │   ├── ai/             # 前端 AI 客户端 + 本地 fallback
│   │   ├── api/            # client / mockStore / communityStore
│   │   ├── archive/        # 档案工具（头像、陪伴天数）
│   │   ├── components/     # UI 组件（含 ToyAvatarStudio）
│   │   ├── context/        # AppContext
│   │   ├── image/          # 抠图 + 贴纸 Canvas
│   │   ├── pages/          # 路由页面
│   │   ├── places/         # 地点服务与工具
│   │   ├── theme/          # 主题
│   │   ├── types.ts
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── wrangler.jsonc
├── plan.md
└── readme.md
```

---

## 4. 前端路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/archive` | TimelinePage | 档案首页 / 当前玩偶卡 |
| `/archive/toys/:id` | ToyArchiveDetailPage | 完整档案 |
| `/toys/new` | NewToyPage | 新增玩偶（抠图贴纸） |
| `/toys` | ToysPage | 玩偶列表 |
| `/compose` | ComposePage | 记日志（类型/地点/AI） |
| `/growth` | GrowthPage | 成长总览 |
| `/growth/travel-map` | TravelMapPage | 旅行轨迹（lazy） |
| `/growth/timeline` | GrowthTimelinePage | 成长时间线（lazy） |
| `/growth/stats/:kind` | GrowthStatsPage | companion/travel/cities/moments |
| `/conversation` | ConversationPage | 对话 + 删记录 |
| `/entries/:id` | EntryDetailPage | 日志详情 |
| `/memories/:id` | MemoryHallPage | 回忆展厅（lazy） |
| `/me` | MePage | 我的 |
| `/me/settings` | SettingsPage | 个人资料设置 / 主题 |

布局：`AppLayout`（shell + BottomNav + 全局 loading 屏 + Toast）。  
对话页锁定外层滚动（`page-scroll--locked`）。

---

## 5. 数据层

### 5.1 类型（`src/types.ts`）

- `Toy`：身份、星座、人设、`avatarUrl`
- `Entry`：类型、日期、`location` + 结构化 `place`、双视角文案
- `Place`：国家/省/市/区/POI/坐标/provider
- `TravelMapPoint` / `TravelMapResponse`

### 5.2 Mock 存储

| Key | 内容 |
|-----|------|
| `toydairy.mock.v3` | toys / entries / currentToyId |
| `toydairy.conversations.v1` | 按 toyId 的聊天消息 |
| `toydairy.quietMode` | 安静模式 |
| profile storage | 用户昵称/头像（`profileStorage`） |

`mockStore` 启动时 seed 演示玩偶与带坐标地点；`attachPlace` 把纯文本地点映射到 seed 坐标以便地图演示。

### 5.3 切换真后端

1. 实现第 6 节 REST（见 `api.md`）  
2. `client.ts`：`USE_MOCK = false`  
3. 设置 `VITE_API_BASE`  
4. 头像/图片上传到 R2，库内只存 URL（代码已 `REPLACE_WITH_BACKEND` 标注）

---

## 6. AI 链路

### 6.1 对话

```
ConversationPage
  → chatToyReply()
    → POST /api/chat  (Functions + aiProvider)
    → 失败：localPersonaReply + 错误气泡/Toast
```

删除聊天：右上角垃圾桶 → 确认 → 清空该 toy 会话并写新开场白。

### 6.2 日记生成

```
ComposePage
  → analyzeEntry()
    → POST /api/analyze-entry
    → 失败/关闭 AI：本地模板 generateLocalAnalysis
  → api.createEntry(+ place)
```

### 6.3 Provider 适配（`aiProvider.ts`）

- OpenAI：`POST {base}/chat/completions`，Bearer  
- Anthropic：`POST {base}/messages`，x-api-key + Bearer  
- 响应解析兼容 `choices[]` 与 `content[{type,text}]`  
- 失败响应带 `auth` 元数据便于排障  

**Base URL 必须含 `/v1`**（中转站常见坑：只写域名会返回 HTML 门户页）。

---

## 7. 地点与地图

```
PlacePicker
  → searchPlaces / reverseGeocode (placeService)
    → /api/places/* 或 Nominatim 或 seed
  → Entry.place

TravelMapPage
  → api.getTravelMap(toyId)
  → Leaflet markers（玩偶头像 DivIcon）
  → 按 date 排序虚线 Polyline
  → 年份筛选 + fitBounds + 拍立得 Popup
```

搜索：**按钮触发**，禁止逐字 autocomplete 打 Nominatim。

---

## 8. 贴纸头像（新增功能）

### 流程

```
相册 / 相机
  → removeToyBackground (dynamic import imgly)
  → createStickerAvatar (Canvas 白边 + 居中 512)
  → ToyAvatarStudio 确认（拖动/缩放/边框/背景）
  → avatarUrl Data URL
  → api.createToy
  → toyAvatar() 全局展示
```

### 模块

| 文件 | 职责 |
|------|------|
| `src/image/removeToyBackground.ts` | 抠图 + 进度 + fallback |
| `src/image/createStickerAvatar.ts` | 裁切、alpha 扩张白边、导出 |
| `src/components/ToyAvatarStudio.tsx` | UI 状态机 pick/processing/confirm |
| `src/pages/NewToyPage.tsx` | 串起档案表单 |

### 许可

`@imgly/background-removal` 为 **AGPL**。黑客松/开源演示可用；闭源商用需更换方案或商业授权。

### 性能

- 模型/WASM **动态 import**，首次抠图需下载  
- 主包不含 20MB+ wasm；进入新增玩偶页再加载  
- MVP 头像进 localStorage，注意容量；大图会尝试 webp 压缩  

---

## 9. 性能策略

| 手段 | 实现 |
|------|------|
| Mock 延迟 | 默认 0ms（写操作 ~40ms） |
| 路由懒加载 | TravelMap / Timeline / Stats / MemoryHall |
| 字体非阻塞 | `index.html` media=print + onload |
| 页面入场动画 | `page-in` ~0.18s |
| 重依赖 | Leaflet / imgly 按需 |

---

## 10. 部署

详见 [`docs/cloudflare.md`](./cloudflare.md)。

```bash
cd web
npm ci
npm run build
npx wrangler pages deploy ./dist --project-name=toydiary --branch=main
```

SPA：`public/_redirects` 非 `/api/*` 回退 `index.html`。

**Dashboard → toydiary → Environment variables → Production：**

```
OPENAI_API_KEY=***
OPENAI_BASE_URL=https://your-gateway/v1
OPENAI_MODEL=your-model
AI_PROVIDER=auto   # 或 openai / anthropic
```

改 env 后需重新部署或等传播。

预留资源（未接线）：

- D1 `toydairy-db`
- KV `TOYDAIRY_KV`
- R2 `toydairy-media`

---

## 11. 安全与隐私

- 模型 Key 仅 Functions  
- 抠图在浏览器本地完成，照片默认不上传服务器  
- CORS `*` 适合演示；生产应按域名收紧  
- Nominatim 代理请控制频率  
- AGPL 依赖披露：见依赖 license  

---

## 12. 已知限制

1. CRUD 无多用户同步（localStorage）  
2. 无正式对象存储；Data URL 头像易撑爆配额  
3. `heart` 类型 UI 有，保存时映射为 `daily`  
4. EXIF 自动地点未接  
5. 社区模块 mock 仍在代码中，产品入口导向对话  
6. 首次抠图模型下载大、耗时长  
7. 项目名拼写：仓库 Toy**Dairy** / 域名 toy**diary** — 以 Cloudflare 项目 `toydiary` 为准  

---

## 13. 相关文档

| 文档 | 内容 |
|------|------|
| [`docs/wiki/README.md`](./wiki/README.md) | **Wiki**（导航 + [Home UI](./wiki/03-home-ui.md)） |
| [`docs/api.md`](./api.md) | HTTP + Mock 契约 |
| [`docs/cloudflare.md`](./cloudflare.md) | 部署 |
| [`docs/PRD.md`](./PRD.md) | 产品范围 |
| [`plan.md`](../plan.md) | 协作计划 |
| [`web/README.md`](../web/README.md) | 前端速览 |
| [`web/env.example.txt`](../web/env.example.txt) | 环境变量示例 |
