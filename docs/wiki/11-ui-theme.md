# 11 · UI 与主题

> 上级：[Wiki 首页](./README.md) · 源码：`web/src/theme/*` · `web/src/index.css`

---

## 视觉定位

**软萌手帐 / scrapbook kawaii**：圆角纸片、拍立得、温暖阴影、低对比墨色字。

| 项 | 值 |
|----|-----|
| 正文字体 | Noto Sans SC（`--font-sans`） |
| 展示字体 | ZCOOL XiaoWei（`--font-display`） — 标题与大数字 |
| 桌面壳 | `.app-shell` 背景 + `.app-frame` 约 390px 手机框 |
| 动效 | `page-in` ~0.18s；按钮 `active:scale-*` |

---

## 主题系统

`ThemeId`：`mint` | `warm` | `sky` | `peach` | `lavender`

| id | 名称 | 一句话 |
|----|------|--------|
| `mint` | 抹茶绿 | 默认清新萌宠 |
| `warm` | 暖杏手帐 | 奶油杏 + 陶土 |
| `sky` | 雾蓝晴空 | 冷调晴空 |
| `peach` | 蜜桃粉 | 粉嫩 |
| `lavender` | 薰衣紫 | 淡紫 |

实现：

- `themes.ts` 定义每套 CSS 变量（`--color-ink`、`--color-matcha`、`--header-from`…）  
- `ThemeProvider` 读 `toydairy.theme`，`applyTheme` 写到 `documentElement`  
- 用户在 `/me/theme` 切换  

Tailwind 4：`@theme` 中注册默认色；运行时变量覆盖同名 custom properties。

---

## 常用组件类（手帐零件）

| 类 / 模式 | 用途 |
|-----------|------|
| `card-paper` | 纸片卡片 |
| `header-band` | 顶栏渐变 |
| `bottom-nav` · `fab-float` | 底栏与中央 FAB |
| `toy-id-card` · `toy-polaroid` | 身份卡与拍立得 |
| `archive-milestone-card` · `archive-stat-card` | Home 纪念与统计 |
| `composer-sheet` | 底部弹层 |
| `loading-screen` · `LoadingBear` | 开屏 |
| `page-scroll` · `page-scroll--locked` | 主滚动区 |

阴影 token：`--shadow-warm` · `--shadow-elevated` · `--shadow-glow`。

---

## Home 相关视觉

详见 [03 · Home 界面](./03-home-ui.md)：

- 身份卡顶条三色点 + `ID CARD`  
- 聊天气泡引导对话  
- 高光三连 polaroid 微旋转  
- 陪伴纪念大数字 `font-display`  
- 四宫格统计 badge + 单位  

---

## 正数日样式

独立持久化：`toydairy.daycount.style`（配色板、背景图案、数字字体）。  
导出时可另选相册背景，**不写回**全站主题。组件：`DayCountNumber` · `DayCountStudioPage`。

---

## 无障碍与触控

- 关键按钮带 `aria-label` / `aria-expanded`  
- 点击热区偏大（`min-h-9` 等）  
- `-webkit-tap-highlight-color: transparent`  
- 对话页锁定外层滚动避免双滚动条  

---

## 下一步

- [Home UI](./03-home-ui.md)  
- [前端路由](./04-frontend.md)  
