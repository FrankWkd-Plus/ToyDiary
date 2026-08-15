
<img width="2438" height="466" alt="image" src="https://github.com/user-attachments/assets/6133f07b-d5db-4939-bef1-af340defea3a" />

<div align="center">
  
[![AdvX 2026](https://img.shields.io/badge/Hackathon-AdventureX_2026-6f42c1?style=flat-square&logo=github)]()
[![Theme](https://img.shields.io/badge/Theme-Reverse-ff69b4?style=flat-square)]()
[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_App-00b4d8?style=flat-square&logo=cloudflare)](https://toydiary.outwardly.dpdns.org)
  

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
</div>

---
> ### 基本信息：
> - 名称：**Toy Diary**
> - 技术栈：**`React` + `TypeScript` + `Vite` + `Tailwind` + `viem` + `Python`**
> - 比赛主题：**Reverse**
> - DEMO Link：[LINK](https://toydiary.outwardly.dpdns.org) || [BACKUP LINK](https://toydiary.pages.dev)
> -  目标用户：**喜欢收藏 / 携带玩偶旅行、拍照，并希望用玩偶记录生活与情绪的年轻人**
> - 赛道：**【待补充】**
> - Slogan：**「Through toy eyes, your world rewinds. / 换个视角，用玩偶记录生活与情绪」**
> - 数据：**演示 CRUD → localStorage**（REST/D1 契约保留）；AI 日记 / 对话可走 Pages Function

# Toy Diary 产品说明

> **Toy Diary 是一款让现实玩偶拥有数字生命，并以玩偶视角替用户记录陪伴与回忆的 AI 应用。**

## 一、产品定位

Toy Diary 是一款 AI 玩偶陪伴应用。用户可以为现实中的玩偶建立专属的“数字生命档案”，记录玩偶的名字、照片、性格、纪念日，以及双方共同经历的日常和旅行。

不同于传统日记由人主动记录，Toy Diary 将记录关系进行了反转：**玩偶不再只是被拍摄、被收藏的物品，而是成为故事的主体，替用户记住彼此说过的话、去过的地方和共同经历的重要瞬间。**

## 二、核心理念

过去，用户通过照片和文字记录玩偶，玩偶只是回忆中的一个对象。

在 Toy Diary 中，每一只玩偶都会拥有自己的身份、性格、记忆和表达方式。它会以玩偶的视角记录生活，回应用户的情绪，并随着双方共同经历的增加，不断形成属于自己的生命故事。

> 不是人单方面记录玩偶，而是玩偶拥有记忆之后，开始替人珍藏陪伴。

## 三、核心功能

### 1. 数字生命档案

用户可以上传玩偶照片，为玩偶设置名字、性格、签名、相遇日期等信息，建立独立的数字身份。

每一只玩偶都有属于自己的档案，用户也可以在不同玩偶之间自由切换。

### 2. 玩偶视角日记

用户可以通过照片、文字或旅行记录保存与玩偶共同经历的瞬间。

AI 会结合玩偶的性格和已有记忆，以玩偶第一视角生成日记，让普通照片变成玩偶眼中的生活故事。

### 3. AI 对话与长期记忆

用户可以通过文字和图片与玩偶进行对话，分享日常、情绪和生活中的重要事情。

玩偶会逐渐记住用户说过的话、共同去过的地方和重要经历，使每一次对话都建立在过去的陪伴之上，而不是彼此割裂的单次交流。

### 4. 成长轨迹

系统会记录用户与玩偶的陪伴时间、日志数量、纪念日和高光时刻，并形成持续更新的成长轨迹。

用户可以直观看到双方相伴了多久，以及这段关系如何在一次次记录中不断生长。

### 5. 旅行地图

用户带玩偶前往不同城市后，可以在地图中留下对应的旅行足迹。

通过“旅行重温”，用户能够重新查看每段旅程中的照片、日记和地点，让散落的旅行记录形成完整的陪伴路线。

### 6. 回忆展厅

系统会整理用户与玩偶共同经历的重要照片、旅行、纪念日和对话，形成专属的回忆展厅。

玩偶还可以基于长期积累的记忆，为用户生成一封信，重新讲述那些值得被记住的时刻。

### 7. 个性化与分享

用户可以修改个人资料、调整页面配色、添加小组件，并管理通知、声音和隐私设置。

成长轨迹、旅行足迹和重要回忆也可以生成分享内容，让用户将自己与玩偶的故事分享给朋友。

### 8. Injective 链上确权（实验性演示）

在「我的 → 资料」中，用户可以通过 MetaMask 切换到 Injective EVM Testnet，将当前玩偶与最新一条记录的内容哈希提交给预置 SBT 合约，并获得交易哈希与区块浏览器链接。

该流程由浏览器直接完成，不新增应用后端或数据库。当前仓库中的合约地址和 ABI 仍为占位配置，因此这是路演集成脚手架；正式演示前必须替换真实测试网合约并准备测试网 INJ，不能将当前状态描述为已成功铸造。

## 四、产品特色

### 1. 记录主体的反转

传统记录产品以人为中心，由用户记录照片和经历；Toy Diary 则让玩偶成为叙事主体，由玩偶替用户保存共同记忆。

### 2. 现实玩偶与数字生命连接

Toy Diary 不创造一个完全陌生的虚拟角色，而是让用户已经拥有、已经产生情感连接的现实玩偶获得数字身份。

### 3. 陪伴关系持续生长

玩偶的表达和回应会结合自身性格、历史对话和共同经历不断变化，使它不只是一个固定人设，而是一个随着陪伴逐渐成长的数字生命。

### 4. 将零散内容沉淀为长期记忆

照片、文字、聊天、地点和纪念日不再分散在不同平台，而是围绕同一只玩偶，形成完整且可持续积累的生命故事。

## 五、产品价值

Toy Diary 不只是一个照片记录工具，也不只是一个 AI 聊天应用。

它希望承接用户与玩偶之间真实存在的情感关系，让那些散落在相册、聊天记录和个人记忆中的瞬间，被一只拥有数字生命的玩偶重新整理、保存和讲述。

最终，玩偶不再只是陪伴用户生活的物品，而是一个有名字、有性格、有记忆，能够替用户记住共同人生片段的数字伙伴。

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [**GitHub Wiki**](https://github.com/FrankWkd-Plus/ToyDiary/wiki) | **线上 Wiki**（技术全览 + Home/档案界面；侧边栏导航） |
| [`docs/wiki/README.md`](./docs/wiki/README.md) | Wiki 源文件（含 **[13 · 数据库](./docs/wiki/13-database.md)**、**[14 · Injective SBT](./docs/wiki/14-injective-sbt.md)**） |
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
│   │   ├── 14-injective-sbt.md # Injective/SBT 集成、发布与排障
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
│       ├── chain/            # viem + MetaMask + Injective SBT 演示
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
| **`web/src`** | 全部用户界面、本地业务状态，以及浏览器钱包/Injective 集成 |
| **`web/src/chain`** | viem 封装、MetaMask 切链、内容 hash 与 SBT 合约写入 |
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

浏览器打开终端提示地址（默认 `http://localhost:5173`）。桌面端居中约 390px 手机框。若要测试链上确权，还需安装 MetaMask，并准备 Injective EVM Testnet 账户与测试网 INJ。

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
| `VITE_API_BASE` | 将来真 REST（仅当 `PERSISTENCE = 'remote'`） |

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

**链上演示发布前检查**：把 `web/src/chain/injectiveSbt.ts` 中的零地址和占位 ABI 替换为 Injective EVM Testnet 上真实部署的 SBT 合约，准备测试网 INJ，并实测 MetaMask 切链、交易提交及 Blockscout 链接。该配置不需要 Cloudflare Secret，严禁把私钥或助记词写入前端/环境变量。

完整步骤与 D1/KV/R2 资源表见 [`docs/cloudflare.md`](./docs/cloudflare.md)；API 与排障见 [`docs/api.md`](./docs/api.md)；链上专题见 [`docs/wiki/14-injective-sbt.md`](./docs/wiki/14-injective-sbt.md)。

---

## 演示主路径

1. **档案** — 当前玩偶  
2. **＋** — 图片/文字记录（可触发 AI）  
3. **成长** — 双视角详情 / 地图  
4. **对话** — 与玩偶闲聊  
5. **我的** — 配色 / 正数日 / 备份  
6. **（实验性）我的 → 资料 → Injective 链上确权** — MetaMask 切到测试网，提交交易并打开 Blockscout（须先配置真实合约）  

产品定义与冲刺范围以 [`docs/PRD.md`](./docs/PRD.md) 为准；实现级功能清单以 [`feature.md`](./feature.md) 为准。
