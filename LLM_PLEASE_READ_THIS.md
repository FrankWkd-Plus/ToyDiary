# LLM_PLEASE_READ_THIS

> **给接下手的 LLM / 开发者的交接说明。改代码前先读完这一页。**
>
> 最后更新：2026-10-14 · 对应分支：`ios`

---

## 这是什么

ToyDiary 的 **iOS 版**（Capacitor 8 包一层 WKWebView）。Web 端本身是一个 React 19 + Vite
的 SPA，部署在 Cloudflare Pages（`https://toydiary.pages.dev`），业务数据走 localStorage，
AI / 地点走 Pages Functions。

iOS 分支已经「能编译、能打包」，但**有一批浏览器上正常、装进 WKWebView 就坏掉的功能**。
下面按影响排序，每条都给了位置和建议修法。

---

## 当前状态

### 已验证

- `npm ci` 干净通过（锁文件与 `package.json` 同步）
- `npm run build:ios`（= `tsc -b && vite build --mode ios`）通过，无类型错误
- 4 个接口的环境变量注入**确实生效** —— 构建产物里能 grep 到绝对地址，无残留相对路径
- 共享 scheme 的 target UUID 与 `project.pbxproj` 一致

### 未验证（别当成已知事实）

- **`xcodebuild archive` 从未真正跑过。** 开发机是 Linux，没有 Xcode。CI 工作流写好了但一次都没执行
- `macos-15` runner 上的 Xcode 版本、Capacitor 8 的最低 Xcode 要求 —— **没查证过**，是按记忆写的
- IPA 能否在真机上安装、装完能否正常启动 —— 全部待验证

所以：**第一次跑 CI 大概率要迭代**。日志第一步就是工具链版本，先看那个。

---

## 已知问题

### 1. 🔴 分享 / 保存 / 导出：提示成功，但什么都不存

**影响面最大。** 路演上点「保存到相册」「导出备份」，toast 弹「已下载」，实际文件系统里什么都没有。

**根因** —— `web/src/share/shareHelpers.ts:42-86`：

```
isMobileClient() 在 iOS 上返回 true
  → 走 navigator.share 分支
  → 但 WKWebView 根本没实现 navigator.share
  → 落到 downloadBlob()，它靠 <a download> 属性
  → WKWebView 没接 WKDownloadDelegate，对 blob: URL 的 a[download] 是空操作
  → 然而函数仍然 return 'downloaded'
  → 调用方据此弹「成功」toast
```

三个环节各自「看起来正常」，串起来就是**静默失败**。

**受影响调用点（5 处）**：

| 位置 | 用户看到的提示 |
|------|----------------|
| `web/src/pages/EntryDetailPage.tsx:202` | 「照片日记已下载」 |
| `web/src/pages/GrowthStatsPage.tsx:168` | 成长图导出 |
| `web/src/pages/DayCountStudioPage.tsx:132` | 正数日卡片导出 |
| `web/src/components/MemoryShareSheet.tsx:105-111` | 「纪念图已下载」 |
| `web/src/pages/MeSubpages.tsx:454-462` | 「完整备份已下载」 |

**建议修法**：在 `shareHelpers.ts` 里加 native 分支 —— `Capacitor.isNativePlatform()` 为真时，
把 blob 写进 `@capacitor/filesystem`（Cache 或 Documents），再用 `@capacitor/share` 的
`Share.share({ files: [uri] })` 弹系统分享面板。**要复用 `web/src/media/photoStorage.ts` 里
已有的 `persistDiaryPhoto` / `persistToyAvatar` 模式** —— 那两个函数已经解决过「blob 落地 + 存
`toydiary-media://` 引用 + `Capacitor.convertFileSrc` 读回」这一整套问题，
`web/src/media/photoStorage.ts:96-208`。

**关键**：返回值必须反映真实结果，别让 UI 再谎报成功。`@capacitor/share` 和
`@capacitor/filesystem`（filesystem 已装）需要进 `web/package.json`。

**别忘**：改完 `package.json` 要再跑一次 `npx cap sync ios`，SPM 的 `Package.swift` 里
本地包列表是 CLI 生成的。

---

### 2. 🟠 拍照识别文字（OCR）：离线完全不可用

**根因** —— `web/src/ocr/recognizeImageText.ts:13-15`：

```ts
const { createWorker } = await import('tesseract.js')
const worker = await createWorker(['chi_sim', 'eng'], 1, { logger })
```

没传 `workerPath` / `corePath` / `langPath`，于是三者全走 tesseract.js 的默认值，**都是 CDN**：

- worker：`https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js`
- wasm core：`cdn.jsdelivr.net/npm/tesseract.js-core@…`
- 语言包：`cdn.jsdelivr.net/npm/@tesseract.js-data/…`（`chi_sim` 有几十 MB）

所以断网时这个功能**永远不可能成功**。不会崩 —— `RecordMethodSheet.tsx:90-101` 和 `:153-157`
有 catch，会退回原图 + 一句提示 —— 但「识别图片文字」这个卖点等于没有。

**次要风险（未确认）**：tesseract.js 默认 `workerBlobURL: true`，用 `blob:` URL 起 Worker。
Capacitor 的自定义 scheme 下 WKWebView 未必允许，**如果是这样，联网也一样失败**。

**建议修法**：把 worker / core / 语言包 vendor 进 `web/public/`，显式传三个 path；
并把 `workerBlobURL` 设为 `false`。注意 `chi_sim` 很大，考虑按需下载 + 缓存到
`@capacitor/filesystem`，而不是打进包里。

---

### 3. 🟠 对话里的图片消息，重开 App 后消失

**根因** —— 图片以 base64 data URL 存进 localStorage，但 iOS WKWebView 的 localStorage
配额只有约 5MB：

- `web/src/pages/ConversationPage.tsx:316,319` —— 允许最多 8MB 的图片转 data URL
- `web/src/conversation/chatStorage.ts:29-31` —— **静默吞掉 `QuotaExceededError`**

写入失败没有任何提示，用户以为发出去了，重开就没了。

**建议修法**：把图片从 localStorage 挪到 `@capacitor/filesystem`，localStorage 里只留引用 ——
跟 `web/src/media/photoStorage.ts` 对日记照片的做法一致。另外 `chatStorage.ts:29-31` 的
catch 至少要上报，别继续静默。

> 注：日记照片和玩偶头像**已经**走 filesystem 了（`photoStorage.ts:155-161,199-208`），
> 所以配额风险集中在对话图片和 `mockStore` / `communityStore`。`web/src/api/communityStore.ts:99-101`
> 也是静默吞。

---

### 4. 🟡 链上确权（Injective SBT）：在 App 里完全不可用

**根因** —— `web/src/chain/injectiveSbt.ts:63-68` 依赖 `window.ethereum`。WKWebView 没有注入的
provider，也没有 wallet 深链处理，所以 `requestAccount()`（`:78`）必然抛错。

**不影响体验**：`web/src/pages/MeSubpages.tsx:100-101` 有 catch 会弹 toast，不崩。

**建议修法**：二选一 —— 在 native 上直接隐藏这个入口（最省事），或者实现 wallet 深链
（`window.open('metamask://…')` + Universal Link 回跳，工作量大）。

**附带**：`web/src/pages/MeSubpages.tsx:164-168` 的区块浏览器链接用了 `target="_blank"`，
WKWebView 里也打不开。只有 mint 成功才会走到，实际上够不着。

---

### 5. 🔵 离线时的资源降级（低优先级，都有兜底）

| 资源 | 位置 | 表现 |
|------|------|------|
| Google Fonts | `web/index.html:16-34` | 回落系统字体，不破版 |
| OSM 地图瓦片 | `web/src/pages/TravelMapPage.tsx:98-101` | 底图空白，已有「底图暂未完整加载」提示条 + 重试（`:143,419-421`） |
| Unsplash 演示图 | `web/src/api/mockStore.ts:476+`、`web/src/community/communityData.ts:140+` | 裂图 |
| Leaflet 标记图标 | — | **无问题**，用的是内联 `L.divIcon`，不依赖 CDN 精灵图（`TravelMapPage.tsx:119-127`） |

---

## 已经处理好、别重复踩的坑

- **`convertFileSrc`**：日记照片和玩偶头像的 hydration 已经接好了
  （`web/src/api/client.ts:85,95`），别再加。
- **safe-area**：`web/src/index.css:63-72` 用 `--safe-top: max(50px, env(safe-area-inset-top, 0px))`
  兜住了 WKWebView 把 `env()` 报成 0 的情况。`index.html:9-12` 也有 `viewport-fit=cover`。
  已经在模拟器上验证过，**不要动**。
- **浏览器版图像工具已删干净**：`onnxruntime-web` / `@imgly/background-removal` 在 `web/` 里
  已无任何引用，抠图改走原生 Vision 插件。根 `package.json` 里还留着 `onnxruntime-web`
  这个孤儿依赖，可以清。
- **`IndexedDB` / `navigator.clipboard`**：全仓库没用到，不用管。

---

## iOS 构建链路（改完代码要做什么）

工作流：`.github/workflows/ios-unsigned-ipa.yml`

- **只在 GitHub Actions 页面手动触发**，没有 push / PR / schedule
- 产物是**未签名** IPA，下载后用 **SideStore** 本地重签安装（免费 Apple ID，7 天过期）
- 详细操作见 [`docs/wiki/14-ios-ipa.md`](docs/wiki/14-ios-ipa.md)

本地改动后要验证 iOS 侧能编译，至少跑：

```bash
cd web
npm ci
npm run build:ios          # tsc -b && vite build --mode ios
npx cap sync ios           # 重新生成 App/App/public 和 SPM 的 Package.swift
```

**两个硬性约束**：

1. **`workflow_dispatch` 的工作流必须存在于默认分支（`main`）**，否则 Actions 页面里
   看不到 Run workflow 按钮。运行时用分支下拉框选 `ios`。
2. **不要创建 `.env.ios`。** 该文件名同时被根 `.gitignore`（`**/.env.*`）和
   `scripts/pre-push.sh:65` 的拦截正则挡住，**提交不了**。iOS 需要的 4 个接口变量走
   workflow 的 `env:` 注入（Vite 的 `loadEnv` 会合并 `process.env` 里 `VITE_` 前缀的变量），
   说明写在 `web/env.example.txt`。

**接口为什么必须绝对地址**：WKWebView 的 origin 是 `capacitor://localhost`，相对路径
`/api/*` 会打到本地空壳。这 4 个必须指到线上：

| 变量 | 落到哪 |
|------|--------|
| `VITE_AI_ANALYZE_ENDPOINT` | `web/src/ai/analyzeEntry.ts:31` |
| `VITE_AI_CHAT_ENDPOINT` | `web/src/ai/chatToyReply.ts:36` |
| `VITE_PLACES_SEARCH_ENDPOINT` | `web/src/places/placeService.ts:17` |
| `VITE_PLACES_REVERSE_ENDPOINT` | `web/src/places/placeService.ts:20` |

Pages Functions 那边 CORS 已经是 `Access-Control-Allow-Origin: *`，跨域没问题。

---

## 工程配置速查

| 项 | 值 |
|----|-----|
| Bundle ID | `com.toydiary.app` |
| 最低 iOS | 15.0（**原生抠图需 iOS 17+**，低版本有降级文案） |
| 设备族 | **仅 iPhone**（`TARGETED_DEVICE_FAMILY = 1`）—— 装 iPad 上是放大兼容模式 |
| Capacitor | 8.5.1，**SPM**（不是 CocoaPods，没有 Podfile） |
| 原生抠图插件 | `ToySubjectPlugin`，Vision，注册在 `web/ios/App/App/SceneDelegate.swift:7-12` |
| 共享 scheme | `web/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`（CI 依赖，别删） |
| 部署目标工程 | `web/ios/App/App.xcodeproj/project.pbxproj` |
| dev 用 Team ID | `X5T88NPQA2`（写在 pbxproj 里；CI 打包时置空） |

---

## 想跑本地热更新

`web/capacitor.config.ts` 里 `server.url` 那两行注释就是给这个用的：先 `npm run dev`，
把 url 改成终端打印的局域网地址，再 `npm run ios:open`。需要一台 Mac。
