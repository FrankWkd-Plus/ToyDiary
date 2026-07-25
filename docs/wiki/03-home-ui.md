# 03 · Home 界面（档案）

> 上级：[Wiki 首页](./README.md)  
> **Home = 底栏「档案」Tab** · 路由 `/archive` · 组件 `TimelinePage`  
> 源码：`web/src/pages/TimelinePage.tsx` · 身份卡：`ToyCard` / `ToyCardCarousel`

---

## 1. 定位

档案页是 App **默认落地页**（`index` → `/archive`），也是 Reverse 故事的开场：

> 先看见**谁**（身份卡），再看见**我们一起走了多远**（陪伴纪念 + 四宫格统计）。

| 项 | 值 |
|----|-----|
| 路由 | `/archive` |
| 页面组件 | `TimelinePage` |
| 布局壳 | `AppLayout`（`page-scroll` + `BottomNav`） |
| 会话门禁 | `RequireSession`（登录或游客均可） |
| 底栏高亮 | `pathname.startsWith('/archive' \| '/entries' \| '/memories')` |
| 状态依赖 | `AppContext`：`toys` · `currentToy` · `entries` · `setCurrentToyId` · `showToast` |
| 鉴权 | `AuthContext.isLoggedIn`（新增玩偶需登录） |

---

## 2. 线框（自上而下）

```
┌─────────────────────────────────────┐  max-w ≈ 390px (app-frame)
│  [avatar] TOY DAIRY          [＋新增玩偶] │  sticky header-band
│           当前玩偶名 ▾                  │
├─────────────────────────────────────┤
│  ◀  ╭───────────────────────╮  ▶     │  ToyCardCarousel
│     │  ID CARD              │        │  横向 snap 轮播
│     │  [头像]  名称 / 星座   │        │
│     │  #性格标签             │        │
│     │  💬「刚刚说…」→ 去聊聊  │        │
│     │  日志 | 城市 | 陪伴天  │        │
│     │  📷 高光 polaroid×3  │        │
│     ╰───────────────────────╯        │
│         ● ○ ○   (指示点)             │
├─────────────────────────────────────┤
│  ✨ 陪伴纪念                          │  archive-milestone-card
│  今天是我们认识的第 N 天               │  → /memories/:id
│  N DAYS                    [拍立得图] │
│  进入回忆展厅 →                       │
├─────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐          │  2×2 ArchiveStatCard
│  │📅 陪伴 N天│  │✈️ 旅行 N次│          │
│  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐          │
│  │🏙️ 城市 N座│  │✨ 瞬间 N条│          │
│  └──────────┘  └──────────┘          │
└─────────────────────────────────────┘
│  档案   成长   (＋)   对话   我的      │  BottomNav
└─────────────────────────────────────┘
```

**空状态：** 无玩偶时，轮播位显示「先创建一只玩偶」卡片；游客会提示先登录。

---

## 3. 区块详解

### 3.1 顶栏 Header

| UI | 行为 |
|----|------|
| 左：当前玩偶头像 + `TOY DAIRY` + 名称 + ▾ | 打开**选择当前玩偶**底部 sheet |
| 右：`＋ 新增玩偶` | 已登录 → `/toys/new`；未登录 → Toast + `/login` |

- 样式：`header-band sticky top-0 z-10`  
- 头像：`toyAvatar(currentToy, index)`（`archive/archiveUtils`）  
- 名称截断：`max-w-[8rem]`

### 3.2 玩偶选择 Sheet

点击顶栏左侧弹出（`fixed` 蒙层 + 底部 `composer-sheet`，`max-w-[390px]`）：

1. 列表所有 `toys`：头像、名称、星座 · 前 2 性格；勾选当前  
2. 点选 → `setCurrentToyId` + Toast「已将 X 设为当前玩偶」  
3. 底栏虚线按钮「新增玩偶」→ 同 `goNewToy()`

**产品语义：**「当前玩偶」影响新增记录、成长列表、对话默认对象。

### 3.3 身份卡轮播 `ToyCardCarousel`

| 项 | 说明 |
|----|------|
| 文件 | `components/ToyCardCarousel.tsx` · `ToyCard.tsx` |
| 交互 | 横向滚动 + snap；滚动停稳同步 `visibleIndex` |
| 联动 | `onVisibleToyChange` → 页内 `viewedToyId`（统计/纪念卡片跟「正在看的卡」走） |
| 与 currentToy | `currentToy` 变化时 `scrollTo` 对齐对应卡片 |
| 数据 | 对每只 toy `api.listEntries(toy.id)` 拉高光图与统计 |

**单卡 `ToyCard` 结构：**

| 区域 | 内容 |
|------|------|
| 顶条 | 三色点 + `ID CARD` |
| 左 | 介绍照（`avatarUrl` 或 `/toy-cards/profile.jpg`）+ `MY TOY` |
| 右 | 名称 · 手绘分隔 · 星座 · 性格 chips · 出生日期 |
| 聊天气泡 | 「{name} 刚刚说」+ 最近一句（`latestToyChatLine`）→ 跳转 `/conversation` |
| 三格统计 | 日志数 · 城市数 · 陪伴天数 |
| 高光时刻 | 最多 3 张 polaroid：优先日记配图（可点进 `/entries/:id`），不足用 `/toy-cards/highlight-*.jpg` |

卡片本身还可点进完整档案等（见轮播内导航：完整档案 `/archive/toys/:id`、高光日记、对话 — 以 `ToyCardCarousel` 内 handler 为准）。

### 3.4 陪伴纪念卡

条件：存在 `viewedToy` 且 `companionDayStatus(viewedToy)` 有值。

| 状态 | 文案 |
|------|------|
| 已相遇 | 「今天是我们认识的第 N 天」+ 大字 `N DAYS` |
| 生日在未来 | 「距离我们相遇还有 X 天」+ `COMING SOON` |

- 右侧倾斜拍立得框展示当前查看玩偶头像  
- 整卡点击 → `/memories/:id`（回忆展厅）  
- 样式类：`archive-milestone-card`

### 3.5 四宫格统计 `ArchiveStatCard`

仅当 **`viewedToy.id === currentToy.id`**（`statsReady`）时用当前 `entries` 计数，避免滑到别的卡却显示错数据：

| 徽章 | 值 | 跳转 |
|------|-----|------|
| 📅 陪伴 | 天数（未来相遇则 0） | `/growth/stats/companion` |
| ✈️ 旅行 | `type === 'travel'` 条数 | `/growth/stats/travel` |
| 🏙️ 城市 | `uniqueCities(places)` | `/growth/stats/cities` |
| ✨ 瞬间 | `entries.length` | `/growth/stats/moments` |

点击前 `requireViewedToy`：若查看卡 ≠ 当前玩偶，先 `setCurrentToyId` 再导航。

地点回退：无 `place` 时用 `seedPlaceForLabel(location)` 估城市。

---

## 4. 状态机与数据

```
AppContext.currentToyId
        │
        ▼
   currentToy ──────────────┐
        │                   │
        │  carousel scroll  │
        ▼                   ▼
  viewedToyId  ◄──── onVisibleToyChange
        │
        ├─ companionDayStatus(viewedToy)
        ├─ avatar = toyAvatar(viewedToy)
        └─ statsReady = viewedToy.id === currentToy.id
              └─ travelCount / cityCount / momentCount
```

| 本地 state | 含义 |
|------------|------|
| `pickerOpen` | 玩偶选择 sheet |
| `viewedToyId` | 轮播可见卡（默认同步 currentToy） |

**无网络 CRUD：** 列表与日记来自 `mockStore`（`toydairy.mock.v3`）。  
**统计口径：** 以「当前玩偶」的 `entries` 为准（Context 在切换 toy 时会重载 entries）。

---

## 5. 导航关系（从 Home 出发）

```
/archive (Home)
  ├─ [新增玩偶] ──登录──► /toys/new
  ├─ [选择玩偶 sheet]
  ├─ ToyCard
  │    ├─ 去聊聊 ──────────► /conversation
  │    ├─ 高光 polaroid ───► /entries/:entryId
  │    └─（完整档案等）────► /archive/toys/:id
  ├─ 陪伴纪念 ─────────────► /memories/:id
  └─ 四宫格 ───────────────► /growth/stats/:kind
```

关联深链：

- 日记详情 `/entries/:id`、回忆 `/memories/*` 在底栏仍点亮「档案」  
- 旧路径 `/timeline` → redirect `/archive`

---

## 6. 关键组件 / 工具索引

| 符号 | 路径 | 职责 |
|------|------|------|
| `TimelinePage` | `pages/TimelinePage.tsx` | Home 页面编排 |
| `ToyCardCarousel` | `components/ToyCardCarousel.tsx` | 轮播 + entries 预取 |
| `ToyCard` | `components/ToyCard.tsx` | 身份卡 UI |
| `ArchiveStatCard` | 同 TimelinePage 内函数组件 | 统计砖块 |
| `toyAvatar` / `companionDayStatus` | `archive/archiveUtils.ts` | 头像回退、陪伴天数 |
| `uniqueCities` / `seedPlaceForLabel` | `places/placeUtils.ts` | 城市统计 |
| `latestToyChatLine` | `conversation/chatStorage.ts` | 气泡预览文案 |
| `BottomNav` | `components/BottomNav.tsx` | 五 Tab + 中央 FAB |
| `AppLayout` | `layout/AppLayout.tsx` | 手机框壳 |

静态资源：

- `/toy-cards/profile.jpg`  
- `/toy-cards/highlight-1.jpg` … `highlight-3.jpg`  
- `public/profile` 等用户/演示图  

---

## 7. 样式与手帐感

| Token / 类 | 用途 |
|------------|------|
| `header-band` | 顶栏渐变（主题 `--header-from/mid`） |
| `toy-id-card` · `toy-profile-photo` · `toy-polaroid` | 身份卡 / 拍立得 |
| `archive-milestone-card` · `archive-stat-card` | 纪念与统计 |
| `composer-sheet` | 底部选择 sheet |
| `font-display`（ZCOOL XiaoWei） | 大数字与标题 |
| `card-paper` | 空状态纸片卡 |

主题切换（我的 → 配色）会改 CSS 变量，Home 随全局主题变色，见 [11 · UI 与主题](./11-ui-theme.md)。

---

## 8. 与完整档案页的区别

| | **Home `/archive`** | **完整档案 `/archive/toys/:id`** |
|--|---------------------|----------------------------------|
| 目标 | 总览 + 切换 + 快捷入口 | 单只玩偶深页 |
| 内容 | 轮播卡、纪念、四宫格 | 活力/电量、bio/独白、相册、更多跳转 |
| 组件 | `TimelinePage` | `ToyArchiveDetailPage` |

---

## 9. 演示话术（路演）

1. 打开即见 **ID CARD** —「它不是滤镜，是有名字和星座的角色」  
2. 滑卡 / 切玩偶 —「可以养很多只，当前这只会跟着记日记和聊天」  
3. 点陪伴纪念 —「第 N 天，进回忆展厅」  
4. 点统计 —「旅行次数、城市脚印可量化」  
5. 再点底栏 **＋** — 进入记一笔主路径  

---

## 10. 已知限制（Home 相关）

1. 统计只在「查看卡 = 当前玩偶」时有真实 entries；滑到其他卡时数字可能为 0（设计如此，避免串数据）  
2. 高光图不足时用静态 fallback，可能不可点进日记  
3. 头像/图多为 Data URL 或 public 静态资源，未接 R2  
4. 游客可看种子数据，**创建玩偶必须登录**  

---

## 下一步

- [前端全路由](./04-frontend.md)  
- [功能地图](./05-features.md)  
- [UI 主题](./11-ui-theme.md)  
