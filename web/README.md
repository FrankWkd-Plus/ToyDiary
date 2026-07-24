# Toy Dairy · Web（前端）

对齐仓库根目录 [`plan.md`](../plan.md) 的 B 角色产出：React + TypeScript + Vite + Tailwind。

当前数据存储为纯前端 Mock（`localStorage`）。智能记录支持本地场景/文字分析，并可通过安全后端接口升级为真实多模态 AI。

## 启动

```bash
cd web
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。桌面端会居中 390px 手机框。

## 可交互路径

| 操作 | 路径 |
|------|------|
| 玩偶档案 | 底栏「档案」 |
| 图片/文字智能记录 | 中间「+」 |
| 日记详情 / 重写 | 点进某条记录 |
| 玩偶成长时间轴 | 「成长」 |
| 玩偶记忆对话 | 「对话」 |
| 身份卡 / 切换玩偶 | 「档案」或「我的」 |
| 重置演示数据 | 「我的」 |

## 多模态 AI 接口

复制 `.env.example` 为 `.env.local`，将 `VITE_AI_ANALYZE_ENDPOINT` 指向你自己的后端接口。前端会向该接口发送玩偶人格、用户文字和压缩后的图片，并接收：

```json
{
  "title": "陪你看日落的傍晚",
  "aiDiary": "玩偶第一视角正文",
  "toyReply": "保存前对用户说的话",
  "mood": "温柔",
  "tags": ["日落", "陪伴"],
  "imageAnalysis": "照片场景说明",
  "entryType": "daily"
}
```

AI 服务不可用时会自动回退到浏览器内的本地生成。不要把 OpenAI 或其他模型服务的 API Key 写进 `VITE_*` 变量。

## 脚本

- `npm run dev` — 开发
- `npm run build` — 类型检查 + 生产构建
- `npm run lint` — oxlint
- `npm run typecheck` — 仅 TS
- `npm run preview` — 预览 dist

## 目录

```
src/
  api/        # client + mockStore（契约）
  components/ # 底栏、身份卡、日志卡片…
  context/    # 全局状态
  pages/      # 页面
  types.ts    # 与 plan 对齐的类型
```
