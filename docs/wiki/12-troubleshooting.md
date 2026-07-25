# 12 · 排障手册

> 上级：[Wiki 首页](./README.md) · API 错误表：[`docs/api.md`](../api.md) §9

---

## AI

| 现象 | 排查 |
|------|------|
| `baseUrl` 仍是 `api.openai.com` | Production 未设 `OPENAI_BASE_URL` 或未重新部署 |
| 401 invalid_api_key | Key 与 base 不匹配（中转 key 打到了官方） |
| 返回 HTML（门户页） | `OPENAI_BASE_URL` 缺 `/v1` |
| Invalid AI provider response | 协议错；设 `AI_PROVIDER` |
| 对话有错误气泡但仍有回复 | **预期**：展示 API 错误 + 本地模板兜底 |
| 日记总是模板腔 | Function 失败或未部署；看 Network `/api/analyze-entry` |

`auth.keyHint` 仅前后缀 + 长度，不会泄露完整 Key。

---

## 地点 / 地图

| 现象 | 排查 |
|------|------|
| 搜不到 | 代理 502 / 网络；前端会落到 seed |
| 地图无点 | Entry 无 `place.lat/lng`；mock 依赖 seed 映射 |
| Nominatim 被限流 | 确认搜索是按钮触发，非逐字请求 |

---

## 数据 / Mock

| 现象 | 排查 |
|------|------|
| 刷新数据丢 | 是否清了站点数据；key 是否仍为 `toydairy.mock.v3` |
| 统计为 0 | Home 上查看卡 ≠ 当前玩偶时 `statsReady=false` |
| 导入失败 | JSON 是否为 `toydairy.growth` 结构；我的 → 数据 |
| localStorage 满 | Data URL 头像过大；压缩 webp / 清演示数据 |

---

## 登录 / 权限

| 现象 | 排查 |
|------|------|
| 无法新建玩偶 | 游客需先登录；演示 OTP 见 `authStorage.DEMO_OTP` |
| 一直回登录 | session key `toydairy.auth.session` 被清 |

---

## 构建 / 部署

| 现象 | 排查 |
|------|------|
| 深链 404 | `_redirects` 是否打进 dist |
| Functions 404 | 是否从 `web/` 部署且 functions 目录在项目根 |
| 改了 Secret 仍旧 | 未 redeploy |
| 类型错误 | `cd web && npm run typecheck` |

---

## 抠图

| 现象 | 排查 |
|------|------|
| 首次极慢 | ONNX 模型下载；需网络 |
| 失败仍有图 | 预期 fallback 原图路径 |
| 商用顾虑 | AGPL 库 — 闭源需换方案 |

---

## 命名混淆

| 写法 | 含义 |
|------|------|
| Toy**Dairy** | 仓库 / 产品文案常见拼写 |
| toy**diary** | Cloudflare Pages 项目名与生产域名 |
| toydairy.* | localStorage / 部分资源命名 |

以 **Dashboard 项目 `toydiary`** 与 **https://toydiary.pages.dev** 为准。

---

## 下一步

- [API](./07-api.md)  
- [部署](./09-deploy.md)  
- [Wiki 首页](./README.md)  
