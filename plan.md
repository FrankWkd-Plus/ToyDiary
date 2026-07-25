# Toy Dairy — 三人 60 小时协作计划

> 目标：在 **60 人时**（3 人 × 约 20h）内交付 **Web 可演示 MVP**。  
> 技术路径：**Web 优先**（跨 OS）→ 后期再打包桌面 App。  
> 产品依据：见 [`docs/PRD.md`](./docs/PRD.md)；功能全集见 [`feature.md`](./feature.md)。

---

## 1. 三人分工（按真实能力）

| 代号 | 角色 | 是否用 Claude Code | 核心职责 | 主要产出 |
|------|------|-------------------|----------|----------|
| **A · 后端** | 全部服务端代码 | ✅ 可用 | API、业务逻辑、鉴权、AI 调用封装、对接 DB/R2 SDK | `server/` 可运行服务 |
| **B · 前端** | 全部 Web UI | ✅ 可用 | 页面、路由、组件、状态、调 API、移动端适配 | `web/` 可演示界面 |
| **C · 基建** | DB / R2 / 杂务 | 偏手动配置 | PostgreSQL 实例与 schema 落地、Cloudflare R2、域名/环境变量、部署、密钥、域名与 CORS、演示环境 | 云资源可用 + 配置文档 + 联调账号 |

### 边界（避免抢活 / 漏活）

| 事项 | 负责人 | 说明 |
|------|--------|------|
| 表结构 SQL / migration 文件 | **A 起草** → **C 在云上执行并确认** | A 写 `migrations/*.sql`；C 建库、跑迁移、给连接串 |
| R2 bucket / 访问密钥 / 公开读策略 | **C** | A 只写上传代码，不自己建账号 |
| OpenAI 等 API Key | **C 申请保管** → 写入服务端 env | A 只读 `process.env`，Key 不进 Git |
| API 路径与 JSON 字段 | **A 定契约**，B/C 对齐 | 改接口必须三人同步 |
| 前端 Mock | **B** | C 的库/R2 未就绪时 B 不阻塞 |
| 部署前端静态站 | **C**（或 B 协助构建产物） | C 管域名与 CDN；B 保证 `npm run build` 过 |
| 部署后端 | **C 配环境** + **A 保证可启动** | C 配 Railway/Render/飞书云等；A 提供 Dockerfile/start 命令 |
| Prompt / AI 文案质量 | **A**（后端内） | 身份卡、日记生成都在 server；B 只展示结果 |
| 演示数据 / 录屏脚本 | **C 主导**，A/B 配合 | C 最熟环境 |

### 协作原则

1. **契约优先（Hour 0–4）**：先锁接口 + 表结构 + R2 对象 key 规则，再分头干。  
2. **C 是阻塞关键路径上的供油车**：连接串、R2、Key 晚一天，A/B 用 Docker Postgres + 本地盘顶上，但正式演示必须切到 C 的环境。  
3. **A/B 可用 Claude Code 狂写；C 以控制台操作为主**，文档必须写清「点哪里、填什么」。  
4. **密钥永不进仓库**；push 前有 `scripts/pre-push.sh` 拦截。  
5. **`main` 始终可演示**；小 PR、短分支。

---

## 2. 60 小时 MVP 边界

### 必须做完

| 模块 | 用户能做什么 |
|------|----------------|
| 玩偶身份卡 | 新建玩偶 → AI 补全星座/简介/独白 → 展示身份卡 |
| 上传记录 | 选图或纯文字；日期、地点、类型 |
| 图存 R2 | 照片进 Cloudflare R2，前端用 URL 展示 |
| AI 日记 | 按玩偶性格生成第一视角文案（服务端） |
| 时间轴 | 按玩偶列日志、点进详情 |
| 基础「我的」 | 玩偶列表切换；演示账号即可 |

### 明确不做（本轮）

- 激活端 / 硬件、社交、完整地图、纪念日展厅动效、插画迁移、会员支付、桌面打包（只写后续说明）

### 推荐技术栈

| 层 | 选型 | 谁主责 |
|----|------|--------|
| 前端 | React + TypeScript + Vite + Tailwind | **B** |
| 后端 | Node.js + Fastify 或 Express + TS | **A** |
| 数据库 | PostgreSQL（Neon / Supabase / RDS 任一） | **C** 建实例，**A** 写访问层 |
| 对象存储 | **Cloudflare R2** | **C** 建 bucket/密钥，**A** 写 put/get |
| AI | OpenAI 兼容 API（服务端） | **C** 提供 Key，**A** 实现调用 |
| 部署 | 前端 Pages/Vercel；后端 Railway/Render/自建 | **C** |
| 桌面（后续） | Tauri / Electron 套 Web | 不计入 60h |

**R2 对象 key 约定（示例，Hour 0 锁定）**

```
toys/{userId}/{toyId}/avatar/{uuid}.jpg
entries/{userId}/{toyId}/{entryId}/{uuid}.jpg
```

公开读可用 R2 自定义域或签名 URL；MVP 优先「公开读 bucket + 随机 key」降低复杂度。

---

## 3. 接口契约（Hour 0 锁定）

```
POST   /auth/demo
GET    /toys
POST   /toys
GET    /toys/:id
PATCH  /toys/:id
POST   /toys/:id/generate-profile

POST   /toys/:id/entries          # multipart: file + 字段
GET    /toys/:id/entries
GET    /entries/:id
POST   /entries/:id/regenerate
```

**创建玩偶**

```json
{
  "name": "Luna",
  "birthDate": "2026-07-23",
  "birthPlace": "上海迪士尼",
  "role": "旅行搭子",
  "traits": ["温柔", "胆小", "好奇"]
}
```

**Entry 字段**：`type`（travel|daily|memorial|text）、`date`、`location`、`title`、`userNote`、`mood`、`imageUrl`、`aiDiary`

**C 需提供给 A 的环境变量（`.env` 不进 Git，只交 `.env.example`）**

```bash
DATABASE_URL=postgresql://...
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_BASE_URL=https://xxx.r2.dev   # 或自定义域
OPENAI_API_KEY=
OPENAI_BASE_URL=                         # 可选
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

---

## 4. 时间线（60 人时）

### Phase 0 · 对齐（0–4h）

| 事项 | 负责人 |
|------|--------|
| 确认 MVP / 不做列表 | 全员 |
| 锁接口契约 + 表结构草案 + R2 key 规则 | **A 主笔**，B/C 签字 |
| 线框 5 页（身份卡 / 新建玩偶 / 编辑记录 / 时间轴 / 详情） | **B** |
| 开通 Postgres、R2、AI Key；写《环境开通手册》半页 | **C** |
| 建 `web/` + `server/` 空仓库可跑 | A + B |

**验收**：三人手里都有同一份契约；C 至少给出本地或云 DB 连接串（可先临时）。

---

### Phase 1 · 垂直切片（4–20h）

| 人 | 任务 |
|----|------|
| **A** | `toys`/`entries` API；本地或真 DB 读写；AI `generate-profile` / `generate-diary`；R2 上传先接 SDK（C 的 key 未好则写 local fallback） |
| **B** | 路由壳 + 底栏 Tab +「+」；新建玩偶表单；身份卡组件；API client + Mock |
| **C** | Postgres 正式实例 + 跑 A 的 migration；R2 bucket、密钥、CORS/公开访问；把 env 安全发给 A；前端预览域名预留 |

**验收**：curl 能建玩偶并拿到 AI 字段；B 用 Mock 或真 API 能画出身份卡；C 确认 R2 控制台能看到测试文件。

---

### Phase 2 · 主路径接通（20–40h）

| 人 | 任务 |
|----|------|
| **A** | 正式走 R2；Entry 全流程；鉴权简版；错误码；与 B 联调；去掉 local 上传（或开关） |
| **B** | 编辑记录（图/文）、时间轴、详情、玩偶切换、加载/空/错状态；接真 API |
| **C** | 部署 backend + frontend；配置生产/演示 env；HTTPS；演示账号；监控/日志最简（平台自带即可）；备份说明 |

**验收**：浏览器走通 **建玩偶 → 上传图到 R2 → AI 日记 → 时间轴详情**；换机刷新数据还在。

---

### Phase 3 · 打磨与演示（40–60h）

| 人 | 任务 |
|----|------|
| **A** | 校验、简单限流、AI fallback、种子数据 API 或 SQL |
| **B** | 手帐风视觉统一、手机宽度、可选分享图 |
| **C** | 演示检查表实操、录屏、回滚预案、费用与配额盯梢、已知问题文档 |

**验收**：任意一人按脚本 5 分钟演示；两条故事线（迪士尼出生 / 鼓浪屿日落）。

---

## 5. 分角色任务清单

### A · 后端（约 20h，Claude Code 友好）

- [ ] `server/` 脚手架 + `.env.example`
- [ ] migration：`users`（可简）、`toys`、`entries`
- [ ] CRUD + multipart 上传
- [ ] R2 SDK 上传/删除；`imageUrl` 写回 DB
- [ ] AI：身份卡 + 第一视角日记（JSON 输出）
- [ ] CORS、统一错误体、健康检查 `GET /health`
- [ ] 启动说明：`npm run dev` / 生产 start

**不做**：控制台里建云资源、DNS、付费绑卡。

### B · 前端（约 20h，Claude Code 友好）

- [ ] Vite + React + TS + Tailwind
- [ ] 底栏：日志 | 成长(占位) | **+** | 玩偶 | 我的
- [ ] 页：玩偶主页/身份卡、新建玩偶、编辑记录、列表、详情、我的简版
- [ ] 类型与 API client（跟 A 契约）
- [ ] Toast / 空状态 / 移动端 390 宽优先

**不做**：自己搭数据库、管 R2 密钥。

### C · 数据库 · R2 · 杂务（约 20h）

- [ ] 注册/整理 Cloudflare 账号；建 R2 bucket；Access Key；公开访问或自定义域
- [ ] 建 PostgreSQL；执行 migration；只读账号可选
- [ ] 申请并保管 AI Key；轮换策略口头约定
- [ ] 配齐 A/B 的本地 `.env`（私发，不进群文件长期留存）
- [ ] 部署前后端；配置 `CORS_ORIGIN`、生产 URL
- [ ] 写 `docs/infra.md`（开通步骤截图级，方便换人接手）
- [ ] 演示环境巡检：磁盘/配额/账单告警
- [ ] 推送钩子：提醒全员 `./scripts/setup-hooks.sh`

**不做**：大段业务代码（除非 A 阻塞时帮忙跑命令）。

---

## 6. 每日节奏

| 节点 | 动作 |
|------|------|
| 开工 15min | 昨天完成 / 今天目标 / **C 是否已交付 env** |
| 中段 | 接口或表结构变更立刻改契约，勿口头漂移 |
| 收工 20min | 合并可运行主干；C 确认演示环境还活着 |
| 阻塞 >1h | A/B 切 Mock 或 local fallback；C 专项清阻塞 |

---

## 7. 仓库结构

```
ToyDairy/
  readme.md              # PRD 原文
  plan.md                # 本计划
  web/                   # B · 前端
  server/                # A · 后端
  docs/infra.md          # C · 基建手册（Phase 中补）
  Images_attachments/
  scripts/
    pre-push.sh          # 每次 push 自动检查
    setup-hooks.sh       # 新 clone 后执行一次
  .githooks/
    pre-push
```

- 分支：`main` 可演示；`feat/a-*` `feat/b-*` `feat/c-*`
- Commit：`feat(api):` / `feat(web):` / `chore(infra):`

### 推送前检查

每次 `git push` 跑 `scripts/pre-push.sh`：

1. 拦截 `.env`、私钥、凭证类路径与可疑 key 文本  
2. 脏工作区警告  
3. 若有 `web/`、`server/` 的 `lint`/`typecheck`/`test` 脚本则执行  

```bash
./scripts/setup-hooks.sh   # 每人 clone 后一次
./scripts/pre-push.sh      # 手动预跑
git push --no-verify       # 紧急跳过（少用）
```

---

## 8. 演示检查表

1. 新建「小熊 Luna」→ 身份卡 + 独白  
2. 上传鼓浪屿图/文字 → AI 日记；**R2 控制台或 URL 可打开图**  
3. 时间轴可进详情  
4. 切换第二只玩偶不串数据  
5. 刷新仍在  
6. AI 失败有兜底文案  

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| C 云资源开通慢 | A 本地 Postgres + 磁盘上传；接口形状不变，Phase 2 再切 R2 |
| R2 CORS / 公网 URL 踩坑 | C 在 Phase 1 用 curl 上传测通再交给 A |
| AI 不稳/贵 | A 做缓存与 fallback；演示可预生成 |
| 接口漂移 | 契约进 Git；破坏性变更拉群 |
| 60h 不够 | 砍成长档案、砍分享图、砍重生成 |
| Key 泄露 | pre-push 拦截；泄露立即轮换（C） |

---

## 10. 60h 之后

1. 成长档案 + 城市列表/地图  
2. 纪念日 + 拍立得分享  
3. 照片插画化  
4. 玩偶对话（记忆检索）  
5. Web → 桌面套壳  
6. 激活端 / 社交  

---

## 11. 一句话

> **B 做出能点的界面，A 写满全部后端（含 AI），C 把数据库、R2 和密钥部署这些「必须自己弄」的坑填平并保证演示环境活着。**  
> 北极星：身份卡 → 上传（R2）→ AI 日记 → 时间轴。60 小时不做第二曲线。
