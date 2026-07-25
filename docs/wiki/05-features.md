# 05 · 功能地图

> 上级：[Wiki 首页](./README.md) · 实现级全文：[`feature.md`](../../feature.md)

---

## 主路径能力

| 能力 | 入口 | 要点 |
|------|------|------|
| **档案 Home** | `/archive` | 身份卡轮播、纪念、统计 — [03](./03-home-ui.md) |
| **新建玩偶** | `/toys/new` | 本地抠图贴纸、星座绑定、AI bio/monologue |
| **记一笔** | ＋ → `/compose` | 相册 / 拍照 OCR / 纯文字；AI 日记 |
| **双视角详情** | `/entries/:id` | userNote ∥ aiDiary；重写仅玩偶侧；分享卡 |
| **成长时间轴** | `/growth` | 日记 + 自动里程碑 |
| **旅行地图** | `/growth?tab=map` | Leaflet、头像 marker、折线、年份筛选 |
| **成长统计** | `/growth/stats/*` | 陪伴 / 旅行 / 城市 / 瞬间 |
| **回忆展厅** | `/memories/:id` | 幻灯片、背景音、正数日分享 |
| **AI 对话** | `/conversation` | 记忆注入、安静模式、清空会话 |
| **正数日** | `/days` | 大数字样式工坊 + PNG 导出 |
| **我的** | `/me` | 昵称头像、5 主题、备份、通知、帮助 |
| **登录** | `/login` | 演示 OTP / 游客；建玩偶需登录 |

---

## 本地浏览器能力（无 HTTP）

| 能力 | 模块 |
|------|------|
| AI 抠图贴纸 | `image/removeToyBackground` · `createStickerAvatar` · `ToyAvatarStudio` |
| OCR | `ocr/recognizeImageText`（tesseract.js） |
| 主题 | `theme/*` |
| 对话缓存 | `conversation/chatStorage` |
| 分享 Canvas | `share/render*Png.ts` |
| 应用内 Nudge | `ToyNudgeHost`（非系统推送） |

---

## 服务端能力

| 能力 | 端点 |
|------|------|
| 玩偶对话 | `POST /api/chat` |
| 双视角日记 JSON | `POST /api/analyze-entry` |
| 地点搜索 | `GET/POST /api/places/search` |
| 逆地理 | `GET /api/places/reverse` |

失败时前端均有**本地模板兜底**，保证演示不断。

---

## 分享与导出

| 产物 | 入口 | 格式 |
|------|------|------|
| 日记卡片 | 日记详情 | PNG |
| 正数日卡片 | `/days`、回忆、统计 | PNG |
| 成长时间轴图 | 我的 | PNG |
| 成长数据备份 | 我的 → 数据 | JSON |

优先 Web Share API，桌面回退下载。

---

## 未主路径 / 部分实现

| 项 | 状态 |
|----|------|
| 玩偶社区 Feed | 代码在，路由重定向对话 |
| 真账号云同步 | 仅本地 session + mock |
| R2 真图床 | bucket 预留 |
| D1 真库 | schema stub |
| EXIF 自动地点 | 未接 |
| 系统推送 / 小组件 | 愿景级 |
| 硬件 pi / bluetooth | `hardware/`，非 Web 硬依赖 |

---

## 下一步

- [数据模型](./06-data-model.md)  
- [API](./07-api.md)  
- [AI](./08-ai.md)  
