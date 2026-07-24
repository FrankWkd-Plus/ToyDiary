# Toy Dairy

让玩偶拥有「灵魂」的 AI 生命手帐：**身份卡 → 双视角日记 → 成长轨迹 → 对话陪伴**。

| | |
|--|--|
| **线上** | https://toydairy.pages.dev |
| **技术** | React + TypeScript + Vite + Tailwind · Cloudflare Pages (+ Functions) |
| **数据** | 浏览器 Mock（localStorage）；AI 日记可走 Pages Function |

相关文档：[`plan.md`](./plan.md)（协作与接口）· [`docs/PRD.md`](./docs/PRD.md)（冲刺范围）· [`docs/api.md`](./docs/api.md)（API）· [`docs/tech.md`](./docs/tech.md)（前后端技术细节）· [`docs/cloudflare.md`](./docs/cloudflare.md)（部署）· [`web/README.md`](./web/README.md)（前端目录）

---

## 产品背景（摘要）

越来越多年轻人会带着玩偶旅行、拍照，将玩偶作为情感陪伴与记忆载体。但玩偶在照片里往往只是「物品」。Toy Dairy 用 AI 赋予玩偶人格与第一视角叙事，让它成为旅程中的陪伴者与记录者。

**目标用户**：喜欢收藏/携带玩偶旅行，并希望用玩偶记录生活与情绪的年轻人。

**核心体验**：创建身份卡 → 上传旅行/日常照片或文字 → 生成主人视角 + 玩偶视角 → 成长时间轴 →（可选）对话与社区。

更完整的原始产品描述与界面设想见本文件下方「附录 · 产品愿景原文」，以及 [`plan.md`](./plan.md)。

---

## 仓库结构

```
ToyDairy/
├── web/                 # 前端 + Pages Functions
│   ├── src/             # React 应用
│   ├── functions/       # Cloudflare Pages Functions（服务端，可放密钥）
│   ├── public/          # 静态资源 + _redirects
│   ├── wrangler.jsonc
│   └── .env.example
├── docs/
│   ├── PRD.md
│   └── cloudflare.md
├── plan.md
└── readme.md            # 本文件
```

---

## 本地开发

```bash
cd web
npm install
cp .env.example .env.local   # 可选
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。桌面端居中约 390px 手机框。

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 → `web/dist` |
| `npm run preview` | 本地预览 `dist` |
| `npm run typecheck` | 仅 TypeScript |
| `npm run lint` | oxlint |

### 前端环境变量（公开）

见 [`web/.env.example`](./web/.env.example)：

| 变量 | 说明 |
|------|------|
| `VITE_AI_ANALYZE_ENDPOINT` | AI 分析接口，默认 `/api/analyze-entry` |
| `VITE_API_BASE` | 将来真 REST API（mock 关闭时用） |

**不要**把模型厂商的 API Key 写成 `VITE_*`（会打进浏览器包）。

---

## 部署流程（Cloudflare Pages）

| 项 | 值 |
|----|-----|
| 项目名 | `toydairy` |
| 生产域名 | https://toydairy.pages.dev |
| 生产分支 | `main` |
| 非主分支 / Preview | 支持 |

### 方式 A · Wrangler 手动部署（常用）

前置：`npx wrangler login`。

```bash
cd web
npm ci
npm run build

# 在 web/ 目录执行：dist = 静态资源；functions/ = Pages Functions
npx wrangler pages deploy ./dist \
  --project-name=toydairy \
  --branch=main \
  --commit-dirty=true
```

预览分支：

```bash
npx wrangler pages deploy ./dist \
  --project-name=toydairy \
  --branch=preview
```

首次创建项目（若尚未创建）：

```bash
npx wrangler pages project create toydairy --production-branch=main
```

### 方式 B · Git 连接自动构建（可选）

Dashboard → **Workers & Pages** → Connect to Git：

| 配置项 | 建议值 |
|--------|--------|
| 生产分支 | `main` |
| Root directory | `web` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 非主分支部署 | 开启 |

### SPA 路由

[`web/public/_redirects`](./web/public/_redirects)：

- `/api/*` → Pages Functions  
- 其它路径 → `/index.html`

---

## AI 密钥（Cloudflare Secrets）

| | |
|--|--|
| 路由 | `POST /api/analyze-entry` |
| 代码 | [`web/functions/api/analyze-entry.ts`](./web/functions/api/analyze-entry.ts) |
| 前端 | `VITE_AI_ANALYZE_ENDPOINT=/api/analyze-entry` |

### 面板设置

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **toydairy**  
2. **Settings** → **Environment variables**  
3. **Production**（建议 Preview 同步）添加：

| 变量 | 类型 | 必填 | 含义 |
|------|------|------|------|
| **`OPENAI_API_KEY`** | **Secret / Encrypt** | 是 | 模型 API Key |
| **`OPENAI_BASE_URL`** | Text 或 Secret | 否 | 默认 `https://api.openai.com/v1` |
| **`OPENAI_MODEL`** | Text | 否 | 默认 `gpt-4o-mini` |

4. **保存后重新部署**（secrets 仅对新部署生效）。

### 调用链

```
浏览器
  → POST /api/analyze-entry     # 无密钥
  → Pages Function              # 读 OPENAI_API_KEY
  → OPENAI_BASE_URL/chat/completions
  → 返回 title / aiDiary / mood …
```

失败时前端回退本地生成。

### 自检

```bash
curl -sS -X POST 'https://toydairy.pages.dev/api/analyze-entry' \
  -H 'content-type: application/json' \
  -d '{"toy":{"name":"Luna","role":"旅行搭子","traits":["温柔"]},"date":"2026-07-24","userNote":"今天很好"}'
```

---

## 其它 Cloudflare 资源

| 资源 | 名称 | 用途（后续） |
|------|------|----------------|
| KV | `TOYDAIRY_KV` | 缓存 / 会话 |
| D1 | `toydairy-db` | 结构化数据 |
| R2 | `toydairy-media` | 图片 |

详见 [`docs/cloudflare.md`](./docs/cloudflare.md)、`web/wrangler.jsonc`。

---

## 演示主路径

1. **档案** — 当前玩偶  
2. **＋** — 图片/文字记录（可触发 AI）  
3. **成长** — 双视角详情  
4. **对话** — 与玩偶闲聊  
5. **我的** — 配色 / 重置演示数据  

---

## 安全

- API Key 只放 Cloudflare Encrypt 变量或本地 `web/.dev.vars`（gitignore）  
- 禁止 commit `.env` / 真实 Key  
- 前端只用公开的 `VITE_*` 地址  

---

## 附录 · 产品愿景原文（节选）

### 用户使用流程（愿景）

购买玩偶 → 创建玩偶身份 → 生成身份卡 → 上传旅行/日常照片 → AI 结合性格生成第一视角日记 → 成长时间轴 → 纪念日回顾 →（远期）对话与玩偶社区。

### 核心模块（愿景）

1. **玩偶身份卡** — 名称、生日、出生地、星座、性格、人设独白  
2. **旅行生命日志** — 照片 + AI 文案 + 地点  
3. **纪念日 / 回忆展厅** — 陪伴天数、幻灯片、分享卡片  
4. **成长档案** — 天数、城市、轨迹  
5. **互动延伸** — AI 对话；玩偶间动态（社区）  

### 移动端底栏（现状对齐）

档案 · 成长 · ＋ · 对话 · 我的  

中间 **＋** 支持相册 / 拍照 / 文字。

---

*部署与密钥以「部署流程」「AI 密钥」两节为准；愿景附录不约束冲刺砍功能清单（见 `docs/PRD.md`）。*
