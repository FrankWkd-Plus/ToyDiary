# 04 · 前端路由与页面

> 上级：[Wiki 首页](./README.md) · 源码：`web/src/App.tsx`

---

## 路由表

### 公开

| 路径 | 页面 | 说明 |
|------|------|------|
| `/login` | `LoginPage` | 手机/邮箱验证码（演示码）、随便看看 |
| `/legal/terms` | `LegalPage` | 服务协议 |
| `/legal/privacy` | `LegalPage` | 隐私政策 |

### 需会话（`RequireSession` + `AppLayout`）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | → `/archive` | 默认 Home |
| `/archive` | **`TimelinePage`** | **Home · 档案** |
| `/archive/toys/:id` | `ToyArchiveDetailPage` | 完整档案 |
| `/memories/:id` | `MemoryHallPage`（lazy） | 回忆展厅 |
| `/timeline` | → `/archive` | 兼容旧链 |
| `/growth` | `GrowthPage` | 时间轴 / `?tab=map` 地图 |
| `/growth/timeline` | → `/growth` | |
| `/growth/travel-map` | → `/growth?tab=map` | |
| `/growth/stats/:kind` | `GrowthStatsPage`（lazy） | companion / travel / cities / moments |
| `/compose` | `ComposePage` | 记一笔 |
| `/conversation` | `ConversationPage` | AI 对话 |
| `/community/*` | → `/conversation` | 社区入口已收 |
| `/toys` | `ToysPage` | 玩偶列表 |
| `/toys/new` | `NewToyPage` | **需 `RequireLogin`** |
| `/entries/:id` | `EntryDetailPage` | 双视角详情 |
| `/days` | `DayCountStudioPage` | 正数日工坊 |
| `/me` | `MePage` | 我的 |
| `/me/profile` · `/me/settings` | `ProfileSettingsPage` | 资料 |
| `/me/theme` | `ThemePickerPage` | 主题 |
| `/me/notify` | `NotifySoundPage` | 通知与声音 |
| `/me/data` | `DataBackupPage` | 备份导入导出 |
| `/me/version` | `VersionPage` | 版本 |
| `/help` · `/help/docs` · `/help/support` · `/help/about` | Help* | 帮助中心 |
| `*` | → `/archive` | 兜底 |

---

## 布局与壳

```
ThemeProvider
  AppProvider          # toys / entries / toast / loading
    AuthProvider
      BrowserRouter
        Routes
          login / legal（无底栏）
          RequireSession → AppLayout
            page-scroll → <Outlet />
            BottomNav
            ToyNudgeHost
        Toast（全局）
```

| 行为 | 实现 |
|------|------|
| 桌面手机框 | `.app-shell` / `.app-frame` ~390px |
| 路由切换回顶 | `scrollRef.scrollTo(0)` on pathname |
| 对话锁滚 | `/conversation` → `page-scroll--locked` |
| 全局 loading | `AppContext.loading` → LoadingBear 开屏 |
| 懒加载 | Stats / MemoryHall（及历史 map/timeline 页若单独用） |

---

## 底栏 `BottomNav`

| Tab | to | 激活条件摘要 |
|-----|-----|----------------|
| 档案 | `/archive` | archive / entries / memories |
| 成长 | `/growth` | growth* |
| ＋ | 打开 `RecordMethodSheet` | 非路由；选方式后进 compose |
| 对话 | `/conversation` | conversation* |
| 我的 | `/me` | me* / toys* |

中央 FAB：渐变 matcha 圆钮 + ✨，`aria-label="新增记录"`。

---

## 页面职责速查

| 页面 | 用户目标 |
|------|----------|
| **TimelinePage** | 看身份、切玩偶、进统计/回忆 — [详解](./03-home-ui.md) |
| NewToyPage | 抠图贴纸 + 表单 + AI 人设 |
| ComposePage | 类型/地点/图文 → AI 双视角 → 保存 |
| EntryDetailPage | 双视角、重写、分享 PNG |
| GrowthPage | 时间轴条目 + 里程碑；地图 Tab |
| TravelMapPage | Leaflet 轨迹（多由 Growth 嵌入/懒载） |
| ConversationPage | 聊天、安静模式、清空 |
| MemoryHallPage | 幻灯片 + 正数日分享 |
| DayCountStudioPage | Days Matter 风样式与导出 |
| MePage + 子页 | 资料、主题、备份、帮助 |
| LoginPage | 演示 OTP / 游客 |

---

## 模块目录（src）

| 目录 | 职责 |
|------|------|
| `pages/` | 路由页面 |
| `components/` | 可复用 UI |
| `layout/` | AppLayout |
| `context/` | AppContext |
| `api/` | client / mock / community |
| `ai/` | analyzeEntry / chatToyReply / generateToyProfile |
| `auth/` | 会话与门禁 |
| `archive/` | 陪伴天数、星座、活力、头像 |
| `places/` | 地点服务 |
| `image/` | 抠图 + 贴纸 |
| `ocr/` | tesseract |
| `conversation/` | 聊天 localStorage |
| `daysmatter/` | 正数日主题 token |
| `share/` | Canvas PNG / JSON 导出 |
| `theme/` | 多主题 CSS 变量 |
| `profile/` | 主人昵称头像 |
| `community/` | 旧社区数据（入口关闭） |

---

## 下一步

- [Home 深挖](./03-home-ui.md)  
- [功能地图](./05-features.md)  
- [数据模型](./06-data-model.md)  
