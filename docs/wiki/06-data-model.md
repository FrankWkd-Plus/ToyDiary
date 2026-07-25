# 06 · 数据模型

> 上级：[Wiki 首页](./README.md) · 类型源码：`web/src/types.ts`  
> **数据库设计（表 / D1 / Repository）见 [13 · 数据库](./13-database.md)** — 演示用 localStorage 实现同一契约。

---

## 分层：Domain vs Database

| 层 | 位置 | 命名 |
|----|------|------|
| **Domain（前端/API JSON）** | `types.ts` | camelCase：`userNote`, `aiDiary` |
| **Database（D1 列）** | `contracts.ts` · migration | snake_case：`user_note`, `ai_diary` |
| **演示落地** | `mockStore` | Domain 对象 JSON 进 `toydairy.mock.v3` |

映射与 SQL 全文 → [13-database](./13-database.md)。

---

## Toy（Domain）

```ts
interface Toy {
  id: string
  name: string
  birthDate: string       // YYYY-MM-DD  → DB birth_date
  birthPlace: string      // → birth_place
  role: string
  traits: string[]        // → traits JSON
  zodiac?: string
  bio?: string
  monologue?: string
  avatarUrl?: string      // → avatar_url；演示 Data URL；正式 R2
  createdAt: string       // → created_at
}
```

`CreateToyInput`：同上字段（无 id/createdAt），供 `api.createToy` ≡ `INSERT toys`。

---

## Entry（Domain）

```ts
type EntryType = 'travel' | 'daily' | 'memorial' | 'text' | 'heart'

interface Entry {
  id: string
  toyId: string           // → toy_id FK
  type: EntryType
  date: string
  location?: string
  place?: Place           // → place JSON
  title?: string
  userNote?: string       // → user_note · 我的视角
  mood?: string
  imageUrl?: string       // → image_url
  aiDiary?: string        // → ai_diary · 玩偶视角
  tags?: string[]         // → tags JSON
  imageAnalysis?: string  // → image_analysis
  createdAt: string
}
```

### 双视角 UI 规则

1. **我的视角**：`userNote` → 否则 `title` → 否则按地点/玩偶兜底句  
2. **玩偶视角**：`aiDiary` → 否则性格模板；「重写」只动玩偶侧  

`ENTRY_TYPE_LABEL`：旅行 / 日常 / 心事 / 纪念日 / 文字  
`COMPOSE_ENTRY_TYPES`：travel · daily · heart · memorial  

---

## Place

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

存库时：`entries.place = JSON.stringify(place)`。

---

## TravelMap

```ts
interface TravelMapPoint {
  entryId: string
  toyId: string
  date: string
  title?: string
  mood?: string
  imageUrl?: string
  aiDiary?: string
  userNote?: string
  place: Place
}

interface TravelMapResponse {
  toyId: string
  points: TravelMapPoint[]
  years: number[]
  cityCount: number
  travelCount: number
}
```

由 `entries` 中带坐标的 `place` **查询派生**（非独立表）。

---

## 演示存储 Keys（local 实现层）

| Key | 逻辑库角色 |
|-----|------------|
| `toydairy.mock.v3` | **主库 dump**：toys + entries + currentToyId |
| `toydairy.conversations.v1` | 对话消息（将来 messages 表） |
| `toydairy.auth.session` | 会话 |
| `toydairy.user.prefs` | 用户偏好 |
| `toydairy.profile.name` / `.avatar` | 主人资料 |
| `toydairy.theme` | 主题 |
| `toydairy.daycount.style` | 正数日样式 |
| `toydairy.nudge.lastAt` | 提醒节流 |
| `toydairy.community.v1` | 社区（入口关） |

---

## D1 表（设计保留 · 演示不执行）

完整 SQL / ER / 资源 ID → **[13 · 数据库](./13-database.md)**。

摘要：

- 表 **`toys`**、**`entries`**（FK + 索引）  
- 资源 **D1 `toydairy-db`** · KV · R2 `toydairy-media`  
- 代码：`ToyRow` / `EntryRow` / `toyToRow` / `rowToEntry`（`contracts.ts`）

### 规划 R2 key

```
toys/{userId}/{toyId}/avatar/{uuid}.jpg
entries/{userId}/{toyId}/{entryId}/{uuid}.jpg
```

---

## 接口保留 vs 演示行为

| 层 | 演示 | 契约 |
|----|------|------|
| `api.*` | localStorage | 与 REST 同名同参 |
| `ToyDairyRepository` | `mockStore` | 将来 D1/HTTP |
| `0001_init.sql` | 不执行 | 权威 schema |
| Domain mappers | 演示可不用 | `toyToRow` / `rowToEntry` 已备 |

---

## 下一步

- [13 · 数据库](./13-database.md)（表、SQL、ER、接库清单）  
- [07 · API](./07-api.md)  
- [09 · 部署](./09-deploy.md)  
