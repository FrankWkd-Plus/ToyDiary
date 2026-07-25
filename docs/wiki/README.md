# Toy Dairy · Wiki

> 项目知识库：产品、技术架构、API、部署，以及 **Home（档案）界面** 的完整说明。  
> **GitHub Wiki**：https://github.com/FrankWkd-Plus/ToyDiary/wiki  
> Demo：https://toydiary.pages.dev · 仓库主路径：`web/`  
> 本目录为 Wiki **源文件**；推送到 `ToyDiary.wiki.git` 后在 GitHub 展示。

---

## 快速入口

| 你想… | 去 |
|--------|-----|
| 了解产品是什么 | [01 · 产品概览](./01-product.md) |
| 看系统怎么拼起来 | [02 · 架构](./02-architecture.md) |
| **读 Home / 档案界面** | [03 · Home 界面（档案）](./03-home-ui.md) ⭐ |
| 查全部路由与页面 | [04 · 前端路由与页面](./04-frontend.md) |
| 查用户功能清单 | [05 · 功能地图](./05-features.md) |
| 查数据模型 | [06 · 数据模型](./06-data-model.md) |
| **查数据库 / D1 设计** | [13 · 数据库](./13-database.md) ⭐ |
| 调 HTTP / 数据 API | [07 · API](./07-api.md) |
| 理解 AI 链路 | [08 · AI 链路](./08-ai.md) |
| 部署 / Secrets / D1·KV·R2 | [09 · 部署与 Cloudflare](./09-deploy.md) |
| 本地开发 | [10 · 开发指南](./10-development.md) |
| 主题 / 视觉系统 | [11 · UI 与主题](./11-ui-theme.md) |
| 排障 | [12 · 排障手册](./12-troubleshooting.md) |

---

## 与现有文档的关系

Wiki 是**导航层 + 界面深挖**；细节仍以专题文档为准：

| 文档 | 角色 |
|------|------|
| [`feature.md`](../../feature.md) | 用户功能全集（实现级） |
| [`docs/PRD.md`](../PRD.md) | 产品需求与冲刺范围 |
| [`docs/api.md`](../api.md) | HTTP + **数据/库契约** 全文 |
| [`docs/tech.md`](../tech.md) | 技术细节全文 |
| [`docs/cloudflare.md`](../cloudflare.md) | 部署与资源 |
| [`plan.md`](../../plan.md) | 三人 60h 协作计划 |
| [`advx_show.md`](../../advx_show.md) | 路演流程 |
| [`daysmatter_feature.md`](../../daysmatter_feature.md) | 纪念日扩展草案 |

**冲突时**：以 `web/src` 代码 + P0 演示故事为准。

---

## 一页摘要

```
产品：让玩偶拥有身份与视角的 AI 生命手帐（主题 Reverse）
形态：移动优先 Web（桌面居中 ~390px 手机框）
栈：  React 19 + TS + Vite + Tailwind 4 · Cloudflare Pages Functions
数据：DB 契约（D1/Repository）+ 演示 localStorage 实现；AI/地点走 /api/*
主路径：档案(Home) → ＋记一笔 → 成长时间轴 → 双视角详情 → 对话/正数日/分享
```

### 底栏五 Tab

| Tab | 路由 | 一句话 |
|-----|------|--------|
| **档案**（Home） | `/archive` | 身份卡轮播、陪伴纪念、统计入口 |
| 成长 | `/growth` | 时间轴 + 旅行地图 |
| **＋** | 弹层 → `/compose` | 相册 / 拍照 OCR / 纯文字 |
| 对话 | `/conversation` | 玩偶 AI 闲聊 |
| 我的 | `/me` | 主题、备份、正数日、帮助 |

---

## 仓库地图（精简）

```
ToyDairy/
├── docs/wiki/          ← 你在这里
├── docs/               # PRD / api / tech / cloudflare
├── web/                # ★ 主应用 SPA + Pages Functions
│   ├── src/pages/      # 路由页面（TimelinePage = Home）
│   ├── src/api/        # contracts（DB 接口）+ mockStore（演示库）
│   ├── migrations/     # D1 schema（设计保留）
│   └── functions/api/  # chat · analyze-entry · places
├── feature.md · plan.md · readme.md
└── hardware/           # 可选，非 Web 主路径
```

---

*Wiki 对齐实现意图日期：2026-07-25。*
