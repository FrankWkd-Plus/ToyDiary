# Toy Dairy

让玩偶拥有「灵魂」的 AI 生命手帐：**身份卡 → 双视角日记 → 成长轨迹 → 对话陪伴**。

| | |
|--|--|
| **线上** | https://toydiary.pages.dev |
| **技术** | React + TypeScript + Vite + Tailwind · Cloudflare Pages (+ Functions) |
| **数据** | 浏览器 Mock（localStorage）；AI 日记 / 对话可走 Pages Function |

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [`docs/wiki/README.md`](./docs/wiki/README.md) | **Wiki 知识库**（技术全览 + **Home/档案界面**深挖） |
| [`feature.md`](./feature.md) | **完整功能说明**（用户能力 + 后端 / DB / AI / 地址） |
| [`docs/PRD.md`](./docs/PRD.md) | **产品需求文档**（定位、原则、MVP 范围、演示脚本） |
| [`docs/api.md`](./docs/api.md) | HTTP API 与 Mock 契约 |
| [`docs/tech.md`](./docs/tech.md) | 前后端技术细节与数据流 |
| [`docs/cloudflare.md`](./docs/cloudflare.md) | 部署、Secrets、KV/D1/R2 |
| [`plan.md`](./plan.md) | 三人 60h 协作计划 |
| [`web/README.md`](./web/README.md) | 前端速览 |
| [`advx_show.md`](./advx_show.md) | 路演流程 |
| [`daysmatter_feature.md`](./daysmatter_feature.md) | 纪念日模块需求草案 |

---

## 项目结构

```
ToyDairy/
├── readme.md                 # 本文件：入口与仓库结构
├── feature.md                # 用户功能全集 + 后端/DB/AI/地址
├── plan.md                   # 协作计划与早期接口约定
├── advx_show.md              # AdventureX 路演脚本
├── daysmatter_feature.md     # 正数日/纪念日扩展 PRD 草案
│
├── docs/
│   ├── wiki/                 # ★ Wiki 知识库（技术 + Home 界面）
│   │   ├── README.md         # Wiki 目录
│   │   ├── 03-home-ui.md     # 档案 Home 界面详解
│   │   └── …                 # 产品 / 架构 / API / 部署 / 排障
│   ├── PRD.md                # 产品需求（从 readme 迁入整理）
│   ├── api.md                # API 文档
│   ├── tech.md               # 技术架构说明
│   └── cloudflare.md         # Cloudflare 部署与资源
│
├── web/                      # ★ 主应用：前端 SPA + Pages Functions
│   ├── package.json
│   ├── vite.config.ts
│   ├── wrangler.jsonc        # Pages / D1 / KV / R2 bindings
│   ├── env.example.txt       # 前端公开 env 示例
│   ├── migrations/
│   │   └── 0001_init.sql     # D1 schema stub（未强制接线）
│   ├── public/               # 静态资源、_redirects、演示图
│   ├── functions/            # Cloudflare Pages Functions（服务端）
│   │   ├── _shared/
│   │   │   └── aiProvider.ts # OpenAI / Anthropic 适配
│   │   └── api/
│   │       ├── chat.ts                 # POST /api/chat
│   │       ├── analyze-entry.ts        # POST /api/analyze-entry
│   │       └── places/
│   │           ├── search.ts           # 地点搜索
│   │           └── reverse.ts          # 逆地理
│   └── src/
│       ├── main.tsx · App.tsx · types.ts · index.css
│       ├── pages/            # 路由页面（档案/成长/记一笔/对话/我的…）
│       ├── components/       # UI（底栏、身份卡、地点选择、抠图工坊…）
│       ├── layout/           # AppLayout
│       ├── context/          # AppContext（toys/entries/toast）
│       ├── auth/             # 登录会话、游客、偏好
│       ├── api/              # client + mockStore + communityStore
│       ├── ai/               # 前端 AI 客户端与本地 fallback
│       ├── archive/          # 陪伴天数、星座、活力
│       ├── conversation/     # 聊天本地存储
│       ├── daysmatter/       # 正数日主题样式
│       ├── image/            # 抠图、贴纸 Canvas
│       ├── ocr/              # tesseract 识别
│       ├── places/           # 地点服务与工具
│       ├── profile/          # 主人昵称头像
│       ├── share/            # PNG/JSON 导出分享
│       ├── theme/            # 多套手帐配色
│       ├── community/        # 社区 Mock 数据（入口已导向对话）
│       └── assets/
│
├── hardware/                 # 可选硬件相关（非 Web 主路径）
│   ├── pi/                   # 树莓派脚本
│   └── bluetooth/            # 蓝牙连接
│
├── scripts/                  # git hooks 等仓库脚本
├── Images_attachments/       # 文档/设计附图
├── package.json              # 仓库根（若有 workspace 辅助）
└── .gitignore
```

### 结构要点

| 区域 | 职责 |
|------|------|
| **`web/src`** | 全部用户界面与本地业务状态 |
| **`web/functions`** | 仅服务端能力：AI、地点代理；**密钥不进前端** |
| **`web/migrations`** | 未来 D1 表结构草案 |
| **`docs/`** | 产品与工程文档 |
| **`feature.md`** | 「用户能用什么」的单一事实来源 |
| **`hardware/`** | 路演/扩展硬件，与 SPA 解耦 |

---

## 本地开发

```bash
cd web
npm install
# 可选：参考 env.example.txt 配置 .env.local
npm run dev
```

浏览器打开终端提示地址（默认 `http://localhost:5173`）。桌面端居中约 390px 手机框。

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 → `web/dist` |
| `npm run preview` | 本地预览 `dist` |
| `npm run typecheck` | 仅 TypeScript |
| `npm run lint` | oxlint |

### 前端环境变量（公开）

见 [`web/env.example.txt`](./web/env.example.txt)：

| 变量 | 说明 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | AI 分析接口，默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 将来真 REST API（`USE_MOCK` 关闭时用） |

**不要**把模型厂商的 API Key 写成 `VITE_*`（会打进浏览器包）。

---

## 部署（摘要）

| 项 | 值 |
|----|-----|
| Cloudflare 项目 | `toydiary` |
| 生产域名 | https://toydiary.pages.dev |
| 生产分支 | `main` |

```bash
cd web
npm ci && npm run build
npx wrangler pages deploy ./dist \
  --project-name=toydiary \
  --branch=main \
  --commit-dirty=true
```

AI 密钥在 Dashboard → **toydiary** → Settings → Environment variables（`OPENAI_API_KEY` 等，Encrypt）。  
完整步骤与 D1/KV/R2 资源表见 [`docs/cloudflare.md`](./docs/cloudflare.md)；API 与排障见 [`docs/api.md`](./docs/api.md)。

---

## 演示主路径

1. **档案** — 当前玩偶  
2. **＋** — 图片/文字记录（可触发 AI）  
3. **成长** — 双视角详情 / 地图  
4. **对话** — 与玩偶闲聊  
5. **我的** — 配色 / 正数日 / 备份  

产品定义与冲刺范围以 [`docs/PRD.md`](./docs/PRD.md) 为准；实现级功能清单以 [`feature.md`](./feature.md) 为准。
