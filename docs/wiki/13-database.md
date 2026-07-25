# 13 · 数据库（契约 + D1 + 演示映射）

> 上级：[Wiki 首页](./README.md)  
> **逻辑库 / 接口始终存在**；演示运行时用 **localStorage 实现同一套 Repository**，不执行 D1 SQL。  
> 源码：`web/src/api/contracts.ts` · `web/src/api/mockStore.ts` · `web/migrations/0001_init.sql` · `web/wrangler.jsonc`

---

## 1. 一句话原则

| 说法 | 含义 |
|------|------|
| **有数据库设计** | 表结构、REST 路径、`ToyDairyRepository`、D1 row 类型、R2 key **全部写在仓库里** |
| **演示不连真库** | `PERSISTENCE = 'localStorage'` → 读写 `toydairy.mock.v3`，**不** `wrangler d1 execute` |
| **接口不删** | UI 只调 `api.*`；以后接 D1/REST 时换实现，不改页面调用形状 |

```
┌──────────── UI / AppContext ────────────┐
│  api.createToy · createEntry · …        │  ← 稳定接口（契约）
└──────────────────┬──────────────────────┘
                   │ ToyDairyRepository
       ┌───────────┴───────────┐
       ▼                       ▼
 mockStore (演示)         未来 remote / D1
 localStorage             HTTP + SQL
 toydairy.mock.v3         toydairy-db
```

---

## 2. Cloudflare 已开通的库资源

| 资源 | 名称 / ID | Binding | 用途 |
|------|-----------|---------|------|
| **D1** | `toydairy-db` · `6ccd35b5-c08a-4eea-9e10-4a04dc577e99` | `DB` | toys / entries 结构化存储 |
| **KV** | `TOYDAIRY_KV` · `f7455bde32684c789bc19a9e6eb01c63` | `TOYDAIRY_KV` | 会话 / 缓存（规划） |
| **R2** | `toydairy-media` | `MEDIA` | 头像与日记图 |

配置：`web/wrangler.jsonc`。  
**演示状态：binding 已声明，业务代码不写 D1/KV/R2。**

---

## 3. ER 关系（逻辑库）

```
┌──────────────── toys ────────────────┐
│ PK id                                │
│ name, birth_date, birth_place, role  │
│ traits (JSON[]), zodiac, bio,        │
│ monologue, avatar_url, created_at    │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐
│ entries                              │
│ PK id                                │
│ FK toy_id → toys.id                  │
│ type, date, location, place (JSON)   │
│ title, user_note, mood, image_url    │
│ ai_diary, tags (JSON), image_analysis│
│ created_at                           │
└──────────────────────────────────────┘

索引：
  idx_entries_toy_date (toy_id, date DESC)
  idx_toys_created (created_at DESC)
```

可选扩展（愿景，未进 migration）：

- `users` / `sessions`（真账号）  
- `conversations` / `messages`（现 localStorage `toydairy.conversations.v1`）  
- `community_posts` 等（现 `toydairy.community.v1`）

---

## 4. D1 Schema（权威 SQL）

文件：[`web/migrations/0001_init.sql`](../../web/migrations/0001_init.sql)

```sql
CREATE TABLE IF NOT EXISTS toys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  birth_place TEXT NOT NULL,
  role TEXT NOT NULL,
  traits TEXT NOT NULL,       -- JSON string[]
  zodiac TEXT,
  bio TEXT,
  monologue TEXT,
  avatar_url TEXT,           -- 正式: R2 URL
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  toy_id TEXT NOT NULL REFERENCES toys(id),
  type TEXT NOT NULL,         -- travel|daily|memorial|text|heart
  date TEXT NOT NULL,
  location TEXT,
  place TEXT,                -- JSON Place
  title TEXT,
  user_note TEXT,            -- 我的视角
  mood TEXT,
  image_url TEXT,
  ai_diary TEXT,             -- 玩偶视角
  tags TEXT,                 -- JSON string[]
  image_analysis TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_toy_date ON entries(toy_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_toys_created ON toys(created_at DESC);
```

接真库时：

```bash
cd web
wrangler d1 execute toydairy-db --remote --file=./migrations/0001_init.sql
```

---

## 5. 行类型（TypeScript · 接口保留）

`web/src/api/contracts.ts`：

```ts
interface ToyRow {
  id: string
  name: string
  birth_date: string
  birth_place: string
  role: string
  traits: string          // JSON string[]
  zodiac: string | null
  bio: string | null
  monologue: string | null
  avatar_url: string | null
  created_at: string
}

interface EntryRow {
  id: string
  toy_id: string
  type: string
  date: string
  location: string | null
  place: string | null    // JSON Place
  title: string | null
  user_note: string | null
  mood: string | null
  image_url: string | null
  ai_diary: string | null
  tags: string | null
  image_analysis: string | null
  created_at: string
}
```

### Domain ↔ DB 字段映射

| Domain (`types.ts`) | D1 列 | 说明 |
|---------------------|-------|------|
| `toy.id` | `toys.id` | |
| `birthDate` | `birth_date` | ISO 日期 |
| `birthPlace` | `birth_place` | |
| `traits[]` | `traits` | `JSON.stringify` |
| `avatarUrl` | `avatar_url` | 演示 Data URL；正式 R2 |
| `entry.toyId` | `entries.toy_id` | FK |
| `userNote` | `user_note` | 我的视角 |
| `aiDiary` | `ai_diary` | 玩偶视角 |
| `place` | `place` | JSON 文本 |
| `tags[]` | `tags` | JSON |
| `imageAnalysis` | `image_analysis` | |

---

## 6. Repository 接口（业务库门面）

同一套方法：演示 = localStorage，正式 = D1/HTTP。

```ts
interface ToyDairyRepository {
  listToys(): Promise<Toy[]>
  getToy(id: string): Promise<Toy | undefined>
  createToy(input: CreateToyInput): Promise<Toy>
  generateProfile(id: string): Promise<Toy>

  listEntries(toyId: string): Promise<Entry[]>
  getEntry(id: string): Promise<Entry | undefined>
  createEntry(toyId: string, input: CreateEntryInput): Promise<Entry>
  updateEntry(id, patch): Promise<Entry>
  regenerateEntry(id: string): Promise<Entry>
  getTravelMap(toyId: string): Promise<TravelMapResponse>

  getCurrentToyId(): string | null
  setCurrentToyId(id: string | null): void
  resetDemo(): unknown
  importGrowth(payload): unknown
}
```

实现：

| 实现 | 文件 | 存储 |
|------|------|------|
| **演示** | `mockStore` | `localStorage` · `toydairy.mock.v3` |
| **正式（规划）** | 未建 | D1 `DB` + R2 `MEDIA` + 可选 REST |

`api/client.ts`：`PERSISTENCE = 'localStorage' | 'remote'`，默认前者。

---

## 7. REST 数据接口（与表对应 · 接口保留）

| Repository / `api.*` | REST | 主要写表 |
|----------------------|------|----------|
| `listToys` | `GET /toys` | toys |
| `getToy` | `GET /toys/:id` | toys |
| `createToy` | `POST /toys` | toys INSERT |
| `generateProfile` | `POST /toys/:id/generate-profile` | toys UPDATE zodiac/bio/monologue |
| `listEntries` | `GET /toys/:toyId/entries` | entries |
| `createEntry` | `POST /toys/:toyId/entries` | entries INSERT |
| `getEntry` | `GET /entries/:id` | entries |
| `updateEntry` | `PATCH /entries/:id` | entries UPDATE |
| `regenerateEntry` | `POST /entries/:id/regenerate` | entries UPDATE ai_diary |
| `getTravelMap` | `GET /toys/:toyId/travel-map` | entries 派生（读 place） |

请求/响应 JSON 字段用 **camelCase domain**（`userNote`），落 D1 时转 **snake_case 列**。

完整 HTTP 细节见 [07 · API](./07-api.md) 与 [`docs/api.md`](../api.md)。

---

## 8. 演示库：localStorage 如何「当数据库」

### 8.1 主库文档结构（≈ 单租户 dump）

Key：`toydairy.mock.v3`（`LOCAL_DB_KEY`）

```json
{
  "toys": [ /* Toy[]  ≡ SELECT * FROM toys */ ],
  "entries": [ /* Entry[] ≡ SELECT * FROM entries */ ],
  "currentToyId": "toy_xxx"
}
```

| 操作 | SQL 语义 | mockStore |
|------|----------|-----------|
| 列表玩偶 | `SELECT * FROM toys` | `listToys` → `load().toys` |
| 新建玩偶 | `INSERT INTO toys` | `createToy` → unshift + `save()` |
| 写日记 | `INSERT INTO entries` | `createEntry` → unshift + `save()` |
| 重写日记 | `UPDATE entries SET ai_diary=…` | `updateEntry` / `regenerateEntry` |
| 切当前玩偶 | 会话偏好（非表或 users 列） | `currentToyId` 字段 |
| 重置演示 | DROP + seed | `removeItem` + `seed()` |
| 导入备份 | 整库 REPLACE | `importGrowth` → `save` |

每次写：`localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data))`。  
配额满：抛中文错误，引导「我的 → 数据」清理。

### 8.2 其它 local「表」

| Key | 逻辑实体 | 将来可进 |
|-----|----------|----------|
| `toydairy.conversations.v1` | 按 toyId 的消息列表 | `messages` 表 |
| `toydairy.auth.session` | 会话 | `sessions` / JWT |
| `toydairy.user.prefs` | 用户偏好 | `user_prefs` |
| `toydairy.profile.*` | 主人昵称头像 | `users` |
| `toydairy.theme` | 主题 | prefs |
| `toydairy.daycount.style` | 正数日样式 | prefs |
| `toydairy.community.v1` | 社区快照 | 多表 |
| `toydairy.quietMode` | 对话开关 | prefs |
| `toydairy.nudge.lastAt` | 提醒节流 | 缓存 / KV |

### 8.3 种子数据

`mockStore.seed()`：演示玩偶（如 Luna）+ 带 `place` 的 entries，保证地图与双视角可讲。  
`applyDemoUpdates`：升级旧 local dump 的文案/配图。

---

## 9. R2 对象存储（媒体库）

| 对象 | Key 约定 |
|------|----------|
| 头像 | `toys/{userId}/{toyId}/avatar/{uuid}.jpg` |
| 日记图 | `entries/{userId}/{toyId}/{entryId}/{uuid}.jpg` |

- **演示**：`avatarUrl` / `imageUrl` 多为 Data URL 或 `/public` 路径，进 localStorage JSON  
- **正式**：只把 URL 写入 D1 `avatar_url` / `image_url`，二进制在 R2  

---

## 10. 与 AI / 地点 API 的边界

这些 **不是业务库**，但会产出写入库的字段：

| 端点 | 产出 | 写入 |
|------|------|------|
| `POST /api/analyze-entry` | title, aiDiary, tags, mood… | `api.createEntry` / `updateEntry` → 演示 local DB |
| `POST /api/chat` | reply | `toydairy.conversations.v1` |
| `/api/places/*` | Place | 进入 `entries.place` 再保存 |

密钥只在 Functions；**永不进库表**。

---

## 11. 接真 D1 检查清单

1. 执行 `0001_init.sql`  
2. 实现 `ToyDairyRepository` 的 D1 版（或 REST 服务端用 D1）  
3. `client.ts`：`PERSISTENCE = 'remote'` + `VITE_API_BASE`  
4. 上传图到 R2，库内只存 URL  
5. 迁移：可选把 `toydairy.mock.v3` 导出 JSON 批量 INSERT  
6. 演示/路演环境 **保持 localStorage**

---

## 12. 相关文档

| 文档 | 内容 |
|------|------|
| 本文 | 库设计总览 |
| [06 · 数据模型](./06-data-model.md) | Domain 类型 |
| [07 · API](./07-api.md) | HTTP + Repository 方法 |
| [09 · 部署](./09-deploy.md) | D1/KV/R2 资源 ID |
| [`docs/api.md`](../api.md) | 契约全文 |
| [`docs/cloudflare.md`](../cloudflare.md) | 开通资源 |
| `web/src/api/contracts.ts` | 代码内接口 |

---

*演示 = local 实现；**数据库设计与接口仍是产品文档的一等公民。***
