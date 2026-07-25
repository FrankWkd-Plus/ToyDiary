# 10 · 开发指南

> 上级：[Wiki 首页](./README.md) · 前端速览：[`web/README.md`](../../web/README.md)

---

## 启动

```bash
cd web
npm install
# 可选：cp env.example.txt → .env.local
npm run dev
```

浏览器打开终端地址（默认 `http://localhost:5173`）。桌面端居中约 390px 手机框。

本地 Functions + Secrets：在 `web/` 配置 `.dev.vars`，用 wrangler pages dev（若团队脚本有封装则从其文档）。

---

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | 仅 TS |
| `npm run lint` | oxlint |
| `npm run preview` | 预览 dist |

---

## 可交互验收路径

| 操作 | 路径 |
|------|------|
| 玩偶档案 Home | 底栏「档案」 |
| 图片/文字智能记录 | 中间「+」 |
| 日记详情 / 重写 | 点进某条 |
| 成长时间轴 / 地图 | 「成长」 |
| 对话 | 「对话」 |
| 身份卡 / 切换 | 档案顶栏或轮播 |
| 重置 / 备份 | 「我的」 |

---

## 协作约定（摘要）

来自 [`plan.md`](../../plan.md)：

1. **契约优先** — API 字段与 R2 key 先锁  
2. **密钥永不进 Git** — `scripts/pre-push.sh` 拦截  
3. **`main` 始终可演示** — 小 PR  
4. Mock 保证 C 的云资源未就绪时 B 不阻塞  

---

## 代码风格提示

- 匹配周围文件的命名与注释密度  
- 新页面：优先放 `pages/`，复用 `PageHeader` / `card-paper` 等既有类  
- 重依赖（Leaflet、imgly）保持 **dynamic import**  
- 改接口同步 `docs/api.md` 与 Wiki [07](./07-api.md)

---

## 下一步

- [架构](./02-architecture.md)  
- [Home UI](./03-home-ui.md)  
- [部署](./09-deploy.md)  
