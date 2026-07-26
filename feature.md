# Toy Dairy · 完整功能说明

> 覆盖**用户当前能用到的全部能力**，以及后端 / 数据库 / 线上地址 / AI 接口。  
> 以仓库实现为准（`web/src`、`web/functions`）；愿景级未落地能力单独标注。  
> 关联：[`docs/PRD.md`](./docs/PRD.md) · [`docs/api.md`](./docs/api.md) · [`docs/tech.md`](./docs/tech.md) · [`docs/cloudflare.md`](./docs/cloudflare.md)

---

## 1. 产品一览

| 项 | 内容 |
|----|------|
| **名称** | Toy Dairy（玩偶生命手帐） |
| **定位** | 让玩偶拥有身份与视角的 AI 生命手帐 |
| **形态** | 移动端优先 Web App（桌面居中约 390px 手机框） |
| **主题** | Reverse — 从「人看玩偶」反转为「玩偶看世界」 |
| **Slogan** | Reverse the gaze. 从物品到陪伴。 |
| **主路径** | 档案 → ＋记一笔 → 成长时间轴 → 双视角详情 → 对话 / 正数日 / 分享 |

### 线上地址

| 用途 | URL |
|------|-----|
| **生产（Cloudflare Pages）** | https://toydiary.pages.dev |
| **备用 / 历史域名写法** | https://toydairy.pages.dev（部分文档旧拼写；以 Dashboard 项目 `toydiary` 为准） |
| **路演自定义域（若已绑）** | https://toydiary.outwardly.dpdns.org（见 `advx_show.md`） |
| **本地开发** | http://localhost:5173（`cd web && npm run dev`） |

### 技术栈摘要

| 层 | 选型 |
|----|------|
| 前端 | React 19 · TypeScript · Vite · Tailwind 4 · react-router 7 · viem |
| 浏览器链上集成 | MetaMask / EIP-1193 → Injective EVM Testnet（chainId `1439`） |
| 后端 | Cloudflare **Pages Functions**（`web/functions`）；链上确权不经过 Functions |
| AI | OpenAI / Anthropic 兼容网关（密钥仅服务端） |
| 地理 | Nominatim（OSM）服务端代理 |
| 当前业务数据 | **浏览器 localStorage**（`PERSISTENCE = 'localStorage'`；CRUD 接口契约保留） |
| 预留云资源 | D1 / KV / R2（已 provision；schema 在 `migrations/`，演示不写库） |

---

## 2. 信息架构与导航

### 2.1 底栏（5 Tab）

| Tab | 路由 | 用户能做什么 |
|-----|------|----------------|
| **档案** | `/archive` | 当前玩偶卡轮播、统计入口、新增玩偶、进完整档案 / 回忆展厅 |
| **成长** | `/growth` | 成长时间轴 + 旅行地图（`?tab=map`） |
| **＋** | 弹层 → `/compose` | 相册 / 拍照(+OCR) / 纯文字 → 智能记一笔 |
| **对话** | `/conversation` | 与当前玩偶 AI 闲聊、安静模式、删会话 |
| **我的** | `/me` | 资料、正数日样式、主题、备份、帮助、退出 |

社区旧路由 `/community/*` **重定向到对话**（代码仍保留 Mock 社区实现，产品入口已收）。

### 2.2 全量路由（用户可达）

| 路径 | 页面 | 能力摘要 |
|------|------|----------|
| `/login` | 登录 | 手机/邮箱验证码（演示码）、随便看看、协议 |
| `/legal/terms` · `/legal/privacy` | 法律页 | 服务协议 / 隐私政策文案 |
| `/archive` | 档案首页 | 见 §3.1 |
| `/archive/toys/:id` | 玩偶完整档案 | 身份、电量活力、相册、入口 |
| `/toys` | 玩偶列表 | 身份卡列表切换 |
| `/toys/new` | 新建玩偶 | 抠图贴纸 + 表单 + AI 人设（需登录） |
| `/compose` | 记一笔 | 类型/地点/AI 日记/保存 |
| `/entries/:id` | 日记详情 | 双视角、重写、分享卡片 |
| `/growth` | 成长中心 | 时间轴 / 地图 Tab |
| `/growth/stats/:kind` | 成长统计 | companion / travel / cities / moments |
| `/memories/:id` | 回忆展厅 | 幻灯片 + 正数日分享 |
| `/conversation` | 对话 | AI 聊天 |
| `/days` | 正数日工坊 | Days Matter 风格大数字卡片样式与导出 |
| `/me` 及子页 | 我的 | 见 §3.9；`/me/profile` 与兼容路由 `/me/settings` 含 Injective 链上确权演示 |
| `/help*` | 帮助中心 | 文档 / 客服 / 关于 |

未匹配路径 → `/archive`。主壳路由包在 `RequireSession`（需登录或游客）。

---

## 3. 用户功能详解

### 3.1 档案（`/archive`）

- **切换当前玩偶**：顶栏下拉 / 卡片轮播联动 `currentToyId`
- **身份卡轮播**（`ToyCardCarousel`）：展示名称、角色、性格、陪伴天数等
- **统计快捷入口**：陪伴天数、旅行次数、城市数、瞬间数 → `/growth/stats/:kind`
- **新增玩偶**：未登录会引导 `/login`；已登录进 `/toys/new`
- **进入完整档案** `/archive/toys/:id`：
  - 头像、角色、**活力/电量**（`toyVitality`）
  - 生日、出生地、星座、简介、人设独白
  - 相册缩略、城市/日记数
  - 跳转成长地图、回忆展厅、记一笔等

### 3.2 新建玩偶（`/toys/new`，需登录）

1. **贴纸头像**
   - 相册/相机选图
   - 浏览器本地 **AI 抠图**（`@imgly/background-removal` + ONNX，动态加载）
   - `ToyAvatarStudio`：拖动/缩放/白边贴纸确认 → Data URL 头像
2. **档案字段**
   - 名称、生日 ↔ **星座双向绑定**、出生地
   - 身份角色（旅行搭子 / 童年伙伴 / 治愈小宠 / 冒险伙伴）
   - 性格标签（最多 4 个）
3. **AI 写人设**
   - 调用对话链路生成 `bio` + `monologue`（失败本地模板）
4. **保存** → `api.createToy`（Mock 写 localStorage）并刷新列表

### 3.3 记一笔 / 智能日记（`/compose`）

**入口（＋弹层 `RecordMethodSheet`）**

| 方式 | 行为 |
|------|------|
| 相册 | 选图 → 带图进 compose |
| 拍照 | 拍照 → **Tesseract OCR** 识别文字填入描述（失败仍可继续） |
| 纯文字 | 无图进 compose |

**表单能力**

- 记录类型：`旅行 / 日常 / 心事 / 纪念日`（UI；`heart` 保存时映射为 `daily`）
- 日期、**结构化地点**（`PlacePicker`：搜索 / 逆地理 / seed 降级）
- 主人叙述 `userNote`、可选图片（≤12MB）
- 开关 **AI 生成**
- 一键分析 → 得到：
  - `title`、`aiDiary`（玩偶第一人称）、`mood`、`tags`、可选 `imageAnalysis`
- 可编辑标题与玩偶日记后保存

**保存结果**：写入当前玩偶的 Entry，出现在成长轴 / 档案统计中。

### 3.4 日记详情 · 双视角（`/entries/:id`）

| 区块 | 内容 |
|------|------|
| **我的视角** | 优先 `userNote`，否则 title / 兜底句；展示用户昵称 |
| **玩偶视角** | 优先 `aiDiary`；可 **重写**（再调 AI 或本地模板，只改玩偶侧） |
| 元信息 | 类型、日期、地点、心情、标签、配图 |
| **分享导出** | Canvas 生成日记卡片 PNG：布局（并排等）、贴纸框、是否显示天数/地点；预览 → 系统分享或下载 |

### 3.5 成长（`/growth`）

**Tab A · 时间轴（默认）**

- 按日期倒序：日记条目 + **自动里程碑**（出生/陪伴天数节点等）
- 切换查看的玩偶
- 点进详情或纪念路径

**Tab B · 旅行地图**（`/growth?tab=map`，Leaflet 懒加载）

- 带坐标的记录点位 + 玩偶头像 marker
- 按日期折线轨迹、年份筛选、fitBounds
- 拍立得风格 Popup（图/文摘要）

**统计子页** `/growth/stats/:kind`

| kind | 含义 |
|------|------|
| `companion` | 陪伴天数大数字 + 分享 |
| `travel` | 旅行记录列表 |
| `cities` | 去过的城市 |
| `moments` | 全部瞬间 |

### 3.6 回忆展厅（`/memories/:id`）

- 该玩偶相关照片 **幻灯片**（自动播放 / 暂停 / 上一张下一张）
- 背景音开关（偏好 `memorySound`）
- **分享正数日卡片**（导出配色/字体/相册背景，**不写回全站正数日主题**）

### 3.7 对话陪伴（`/conversation`）

- 按玩偶分会话（localStorage `toydairy.conversations.v1`）
- **开场白**结合最近记忆 / 时段
- 快捷话题：说说今天 / 回忆旅行 / 记得什么 / 安慰 / 一起写日记
- 发文字；可附图片（data URL）进入上下文
- **AI 回复**：`POST /api/chat`；失败 → 本地人格模板 + 错误提示气泡
- 注入近期 **共同记忆**（entries 摘要）与玩偶人格
- **安静陪伴**（`toydairy.quietMode`）：更短回复、少追问；并抑制主动 nudge
- **清空本玩偶聊天**（确认后重写开场白）
- 可从对话跳去记日记

### 3.8 正数日 / Days Matter 风（`/days`）

- 展示与当前玩偶的 **相遇第 N 天 / 还有 N 天**（生日在未来则倒数）
- 样式工坊：配色板、背景图案、数字字体（全站持久化 `toydairy.daycount.style`）
- 导出时可另选相册背景（仅导出，不污染站点主题）
- 导出 PNG 分享 / 下载
- 档案与统计页的大数字组件共用同一套样式

### 3.9 我的（`/me`）

| 能力 | 说明 |
|------|------|
| 昵称 / 头像 | 本地 profile；头像 ≤3MB Data URL |
| 登录态展示 | 账号 / 游客；退出回登录 |
| 正数日样式 | 进 `/days` |
| 切换配色 | 5 套主题：抹茶绿 / 暖杏手帐 / 雾蓝晴空 / 蜜桃粉 / 薰衣紫 |
| 成长轨迹分享图 | Canvas 时间轴 PNG → 分享或下载 |
| 通知与声音 | 见下 |
| 数据备份 | JSON 导出/导入 toys+entries（覆盖本地） |
| 版本信息 | 0.1.0-demo 等 |
| 帮助中心 | 使用文档 / 客服占位 / 关于 |
| 个人资料设置 | 手机号、微信、设备备注（演示本地 prefs） |
| Injective 链上确权（实验性） | `/me/profile` 或 `/me/settings`：MetaMask 切链 → 当前玩偶/最新记录 hash → SBT 合约写入 → 交易浏览器链接 |

**通知与声音（应用内卡片，非系统推送）**

- 总开关：玩偶响应提醒
- 想你/闲聊、日记催更、旅行回忆、夜间/电量
- 频率：佛系 / 适中 / 话唠
- 回忆展厅声音
- 实现：`ToyNudgeHost` 定时弹出可跳转卡片

### 3.10 登录与会话

| 模式 | 行为 |
|------|------|
| **手机 / 邮箱 + 验证码** | 演示验证码固定（见 `authStorage.DEMO_OTP`）；本地 session |
| **随便看看（游客）** | 可浏览演示数据；**新建玩偶需正式登录** |
| 协议勾选 | 服务协议 + 隐私政策链接 |

会话键：`toydairy.auth.session`；偏好：`toydairy.user.prefs`。

### 3.11 分享与导出一览

| 产物 | 入口 | 格式 |
|------|------|------|
| 日记卡片 | 日记详情 | PNG |
| 正数日卡片 | `/days`、回忆展厅、统计 | PNG |
| 成长时间轴图 | 我的 | PNG |
| 成长数据备份 | 我的 → 数据 | JSON `toydairy.growth` |

移动端优先 Web Share API，桌面回退下载。

### 3.12 本地浏览器能力（无服务端）

| 能力 | 模块 |
|------|------|
| 抠图贴纸 | `image/removeToyBackground` · `createStickerAvatar` |
| OCR | `ocr/recognizeImageText`（tesseract.js） |
| 主题 | `theme/*` |
| 对话缓存 | `conversation/chatStorage` |
| 社区 Mock（无入口） | `api/communityStore` |
| Injective 链上确权 | `chain/injectiveSbt`（viem + MetaMask；不经过应用后端） |

#### Injective 链上确权交互（实验性）

1. 用户在「我的 → 资料」点击「发起链上确权」。
2. 浏览器请求 MetaMask 账户，并切换/添加 Injective EVM Testnet（chainId `1439`）。
3. 前端从 `AppContext` 读取当前玩偶和最新记录，取玩偶 `id/name/birthDate` 与记录 `id/date/title/userNote/aiDiary`，在浏览器内计算 `keccak256`。
4. 前端假定调用公开合约 `mint(address to, bytes32 dataHash)`，由 MetaMask 完成签名并返回交易 hash。
5. 页面展示交易 hash 的截断值和 Blockscout 链接。

这条链路不新增 ToyDairy HTTP API、Pages Function、Worker 或数据库。当前实现不等待 receipt、不读取链上状态，也不保存交易 hash。`SBT_CONTRACT_ADDRESS` 仍是零地址且 ABI 为占位，因此当前只能视为集成脚手架；路演前必须替换真实合约配置。

### 3.13 硬件（仓库附带，非 Web 主路径）

| 路径 | 说明 |
|------|------|
| `hardware/pi/` | 树莓派相关 bat 脚本 |
| `hardware/bluetooth/` | 蓝牙连接脚本 / Python |

路演可展示；**Web 功能清单不依赖硬件在线**。

### 3.14 未作为主路径开放 / 部分实现

| 项 | 状态 |
|----|------|
| 玩偶社区 Feed | 代码在，路由重定向到对话 |
| 真账号云同步 / 多端 | 仅本地 session + mock |
| R2 真图床 | 预留 bucket，头像/日记图多为 Data URL / 静态 public |
| D1 真库读写 | schema stub，未接 `api` |
| EXIF 自动地点 | 未接 |
| 系统级推送 / iOS 小组件 | 愿景 / 演示文案级 |
| 自定义多纪念日实体 | 见 `daysmatter_feature.md` 草案；当前为正数日+memorial 类型 |
| Injective SBT 真铸造 | UI/钱包/切链/hash/合约写入已接；合约地址为零地址、ABI 为占位，尚不能完成真实铸造；无 receipt、回读或交易记录 |

---

## 4. 核心数据模型（产品语义）

### Toy（玩偶）

```
id, name, birthDate, birthPlace, role, traits[]
zodiac?, bio?, monologue?, avatarUrl?, createdAt
```

### Entry（日记 / 事件）

```
id, toyId
type: travel | daily | memorial | text | heart
date, location?, place?, title?, userNote?, mood?
imageUrl?, aiDiary?, tags?, imageAnalysis?, createdAt
```

| 字段 | 产品含义 |
|------|----------|
| `userNote` | **我的视角**（主人叙述） |
| `aiDiary` | **玩偶视角**（第一人称日记） |
| `place` | 结构化地点（地图必需：lat/lng + displayName…） |

### Place

```
displayName, lat, lng
country?, region?, city?, district?, poi?
provider?: nominatim | manual | exif | geolocation | seed
```

---

## 5. 存储与数据库

> **数据库设计是一等公民**（表 / REST / Repository / D1 资源 ID 均在仓库）。  
> 演示运行时用 localStorage **实现**同一套接口，不执行 D1 SQL。  
> 总览：[`docs/wiki/13-database.md`](./docs/wiki/13-database.md) · 契约：`web/src/api/contracts.ts`

### 5.1 逻辑库（始终存在）

| 表 | 含义 | Domain 类型 |
|----|------|-------------|
| **toys** | 玩偶身份卡 | `Toy` |
| **entries** | 双视角日记 / 事件 | `Entry`（含 `place` JSON） |

接口：`ToyDairyRepository` + REST（`GET/POST /toys`、`/entries`…）— 见 `contracts.ts` / `docs/api.md` §6。

### 5.2 演示实现（localStorage）

业务 CRUD **经 `api.*` 写入浏览器**，不连 D1：

| localStorage Key | 逻辑角色 |
|------------------|----------|
| `toydairy.mock.v3` | **主库 dump** ≡ toys + entries + currentToyId |
| `toydairy.conversations.v1` | 对话消息（将来 messages 表） |
| `toydairy.quietMode` | 对话安静模式 |
| `toydairy.auth.session` | 登录 / 游客 |
| `toydairy.user.prefs` | 通知、手机微信备注等 |
| `toydairy.profile.name` / `.avatar` | 主人昵称头像 |
| `toydairy.theme` | 主题 id |
| `toydairy.daycount.style` | 正数日样式 |
| `toydairy.nudge.lastAt` | 上次主动提醒时间 |
| `toydairy.community.v1` | 社区（入口已关） |

种子数据：演示玩偶（如 Luna）+ 带地点的日记。  
**重置演示数据**：我的页相关入口。

### 5.3 已开通的 Cloudflare 数据库资源

配置：`web/wrangler.jsonc` · 说明：`docs/cloudflare.md` · Wiki：`13-database`

| 资源 | 名称 / ID | Binding | 用途 |
|------|-----------|---------|------|
| **D1** | `toydairy-db` · `6ccd35b5-c08a-4eea-9e10-4a04dc577e99` | `DB` | toys / entries |
| **KV** | `TOYDAIRY_KV` · `f7455bde32684c789bc19a9e6eb01c63` | `TOYDAIRY_KV` | 缓存 / 会话 |
| **R2** | `toydairy-media` | `MEDIA` | 头像与日记图片 |

### 5.4 D1 Schema（设计权威 · 演示不强制执行）

文件：`web/migrations/0001_init.sql`

```sql
-- toys: id, name, birth_date, birth_place, role, traits(JSON),
--       zodiac, bio, monologue, avatar_url, created_at
-- entries: id, toy_id, type, date, location, place(JSON), title,
--          user_note, mood, image_url, ai_diary, tags, image_analysis, created_at
-- INDEX idx_entries_toy_date (toy_id, date DESC)
-- INDEX idx_toys_created (created_at DESC)
```

应用示例（接真库时）：

```bash
wrangler d1 execute toydairy-db --remote --file=./migrations/0001_init.sql
```

代码侧已有 `ToyRow` / `EntryRow` 与 `toyToRow` / `rowToEntry` 映射（`contracts.ts`）。

### 5.5 切换真后端时的约定

1. 实现 REST / D1 Repository（见 `docs/api.md` §6 / `contracts.ts` / Wiki 13）  
2. `web/src/api/client.ts`：`PERSISTENCE = 'remote'`（**勿在演示环境改**）  
3. 设置 `VITE_API_BASE`  
4. 跑 D1 migration；图片上传 R2，库内只存 URL  
5. 演示/路演请保持 **`PERSISTENCE = 'localStorage'`**

规划对象 key：

```
toys/{userId}/{toyId}/avatar/{uuid}.jpg
entries/{userId}/{toyId}/{entryId}/{uuid}.jpg
```

---

## 6. 后端与 HTTP API

运行时：**Cloudflare Pages Functions**（与静态 `dist` 同项目部署）。  
CORS：Functions 层 `Access-Control-Allow-Origin: *`（演示向）。  
详细契约：[`docs/api.md`](./docs/api.md)。

### 6.1 已实现 HTTP

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 玩偶对话 |
| `OPTIONS` | `/api/chat` | CORS |
| `POST` | `/api/analyze-entry` | 双视角日记 JSON |
| `OPTIONS` | `/api/analyze-entry` | CORS |
| `GET`/`POST` | `/api/places/search` | 地点搜索（Nominatim 代理） |
| `GET` | `/api/places/reverse` | 逆地理 `lat` + `lon`/`lng` |

源码：

```
web/functions/
  _shared/aiProvider.ts      # OpenAI / Anthropic 适配
  api/chat.ts
  api/analyze-entry.ts
  api/places/search.ts
  api/places/reverse.ts
```

### 6.2 AI 接口细节

#### `POST /api/chat`

**请求（摘要）**

```json
{
  "message": "今天有点累",
  "quietMode": false,
  "toy": { "name": "…", "role": "…", "traits": [], "bio": "…", "monologue": "…" },
  "history": [{ "role": "user|toy|assistant", "text": "…" }],
  "memories": [{ "title": "…", "location": "…", "date": "…", "note": "…" }]
}
```

**成功**

```json
{ "reply": "…", "source": "api", "auth": { "provider": "…", "model": "…", "keyConfigured": true } }
```

前端：`web/src/ai/chatToyReply.ts`。失败本地人格回复。

#### `POST /api/analyze-entry`

**请求（摘要）**

```json
{
  "date": "2026-07-24",
  "location": "上海 · 武康路",
  "userNote": "今天带熊看日落",
  "imageDataUrl": "data:image/jpeg;base64,…",
  "toy": { "name": "…", "role": "…", "traits": [], "bio": "…", "monologue": "…" }
}
```

**成功字段**：`title` · `aiDiary` · `toyReply` · `mood` · `tags` · `imageAnalysis?` · `entryType`

前端：`web/src/ai/analyzeEntry.ts`。失败 `generateLocalAnalysis`。

#### Provider 适配（`aiProvider.ts`）

| 模式 | 行为 |
|------|------|
| `AI_PROVIDER=openai` | `POST {base}/chat/completions` |
| `AI_PROVIDER=anthropic` | `POST {base}/messages` |
| `auto`（默认） | 按 base URL / 模型名（如 `claude-*`）判断；可回退 |

**Base URL 须含 `/v1`**（中转站常见坑）。

#### 服务端环境变量（Dashboard / `web/.dev.vars`，**禁止** `VITE_*`）

| 变量 | 类型 | 必填 | 含义 |
|------|------|------|------|
| `OPENAI_API_KEY` | Secret | 是* | 上游 Key（OpenAI/Anthropic 网关通用名） |
| `OPENAI_BASE_URL` | Text/Secret | 否 | 默认官方 OpenAI 或 Anthropic |
| `OPENAI_MODEL` | Text | 否 | 如 `gpt-4o-mini` / `claude-3-5-haiku-latest` |
| `AI_PROVIDER` | Text | 否 | `openai` \| `anthropic` \| `auto` |

\* 地点 API 不需要 AI Key。

#### 前端公开环境变量

| 变量 | 含义 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | 默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 将来真 REST 基址（仅 `PERSISTENCE = 'remote'`） |

示例文件：`web/env.example.txt`。

### 6.3 Mock / 未来 REST 契约（`api` 客户端）

`PERSISTENCE = 'localStorage'` 时以下**不发 HTTP**，走 `mockStore`（localStorage）：

| 客户端方法 | 建议 REST |
|------------|-----------|
| `listToys` / `getToy` / `createToy` | `GET/POST /toys` · `GET /toys/:id` |
| `generateProfile` | `POST /toys/:id/generate-profile` |
| `listEntries` / `createEntry` | `GET/POST /toys/:toyId/entries` |
| `getEntry` / `regenerateEntry` | `GET /entries/:id` · `POST /entries/:id/regenerate` |
| `getTravelMap` | `GET /toys/:toyId/travel-map` |

### 6.4 调用链示意

```
┌──────────── Browser SPA ────────────┐
│  Pages + Context + mockStore        │
│  抠图 / OCR / 分享 Canvas（本地）    │
└───────────────┬─────────────────────┘
                │ fetch /api/*
                ▼
┌──── Cloudflare Pages (toydiary) ────┐
│  dist/ 静态                          │
│  Functions: chat · analyze · places  │
└───────────────┬─────────────────────┘
                │
     ┌──────────┼──────────┐
     ▼          ▼          ▼
 OpenAI/     Nominatim   (预留)
 Anthropic   OSM         D1/KV/R2
```

### 6.5 自检 curl

```bash
# 对话
curl -sS https://toydiary.pages.dev/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"你好","toy":{"name":"Luna","role":"伙伴","traits":["温柔"]}}'

# 日记分析
curl -sS -X POST 'https://toydiary.pages.dev/api/analyze-entry' \
  -H 'content-type: application/json' \
  -d '{"toy":{"name":"Luna","role":"旅行搭子","traits":["温柔"]},"date":"2026-07-24","userNote":"今天很好"}'

# 地点
curl -sS 'https://toydiary.pages.dev/api/places/search?q=%E5%A4%A7%E7%90%86&limit=5'
```

---

## 7. 部署要点（功能依赖）

| 项 | 值 |
|----|-----|
| Pages 项目 | `toydiary` |
| 生产分支 | `main` |
| 构建 | `cd web && npm ci && npm run build` → `dist` |
| 部署 | `npx wrangler pages deploy ./dist --project-name=toydiary --branch=main` |
| SPA | `public/_redirects`：`/api/*` → Functions，其它 → `index.html` |

改 Secrets 后需重新部署。完整步骤见 [`docs/cloudflare.md`](./docs/cloudflare.md) 与根 [`readme.md`](./readme.md)。

---

## 8. 安全与隐私（功能相关）

- 模型 Key **只**在 Pages Functions / `.dev.vars`
- 抠图默认在浏览器完成，原图不强制上传
- 演示 CORS 宽松；生产应收紧域名
- Nominatim 搜索须**按钮触发**，禁止逐字轰炸
- AGPL 抠图库：黑客松/开源演示可用，闭源商用需评估

---

## 9. 文档地图

| 文档 | 内容 |
|------|------|
| **`feature.md`（本文）** | 用户功能全集 + 库/地址/AI |
| [`docs/wiki/README.md`](./docs/wiki/README.md) | **Wiki**：技术导航 + [Home/档案界面](./docs/wiki/03-home-ui.md) |
| [`docs/PRD.md`](./docs/PRD.md) | 产品需求与冲刺范围 |
| [`docs/api.md`](./docs/api.md) | HTTP 与 Mock 契约 |
| [`docs/tech.md`](./docs/tech.md) | 前后端技术细节 |
| [`docs/cloudflare.md`](./docs/cloudflare.md) | 部署与资源 |
| [`plan.md`](./plan.md) | 协作与 60h 计划 |
| [`daysmatter_feature.md`](./daysmatter_feature.md) | 纪念日模块需求草案 |
| [`advx_show.md`](./advx_show.md) | 路演流程 |

---

*最后对齐实现日期意图：2026-07-25。若 UI 与本文冲突，以 `web/src/App.tsx` 路由与页面代码为准。*
