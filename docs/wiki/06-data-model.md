# 06 · 数据模型

> 上级：[Wiki 首页](./README.md) · 类型源码：`web/src/types.ts`

---

## Toy

```ts
interface Toy {
  id: string
  name: string
  birthDate: string       // YYYY-MM-DD
  birthPlace: string
  role: string
  traits: string[]
  zodiac?: string
  bio?: string
  monologue?: string
  avatarUrl?: string      // MVP: Data URL；正式: R2 URL
  createdAt: string
}
```

`CreateToyInput`：同上字段（无 id/createdAt），供 `api.createToy`。

---

## Entry

```ts
type EntryType = 'travel' | 'daily' | 'memorial' | 'text' | 'heart'

interface Entry {
  id: string
  toyId: string
  type: EntryType
  date: string
  location?: string       // 展示用纯文本
  place?: Place           // 地图必需
  title?: string
  userNote?: string       // 我的视角
  mood?: string
  imageUrl?: string
  aiDiary?: string        // 玩偶视角
  tags?: string[]
  imageAnalysis?: string
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

---

## localStorage Keys

| Key | 内容 |
|-----|------|
| `toydairy.mock.v3` | toys / entries / currentToyId |
| `toydairy.conversations.v1` | 按 toyId 聊天 |
| `toydairy.quietMode` | 安静模式 |
| `toydairy.auth.session` | 登录 / 游客 |
| `toydairy.user.prefs` | 通知、备注等 |
| `toydairy.profile.name` / `.avatar` | 主人资料 |
| `toydairy.theme` | 主题 id |
| `toydairy.daycount.style` | 正数日样式 |
| `toydairy.nudge.lastAt` | 上次 nudge |
| `toydairy.community.v1` | 社区 mock（入口关） |

---

## D1 Schema Stub（未接线）

`web/migrations/0001_init.sql`：

- `toys`：身份字段 + avatar_url  
- `entries`：类型、日期、location、双视角文案…  
- `INDEX idx_entries_toy_date (toy_id, date DESC)`  

> 接真库时需扩展 **place JSON** 列。

### 规划 R2 key

```
toys/{userId}/{toyId}/avatar/{uuid}.jpg
entries/{userId}/{toyId}/{entryId}/{uuid}.jpg
```

---

## 切换真后端清单

1. 实现 REST（见 [07-api](./07-api.md) / `docs/api.md` §6）  
2. `client.ts`：`USE_MOCK = false`  
3. `VITE_API_BASE`  
4. 图上 R2，库内只存 URL  

---

## 下一步

- [API](./07-api.md)  
- [存储与部署](./09-deploy.md)  
