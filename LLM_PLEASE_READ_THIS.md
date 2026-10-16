# LLM_PLEASE_READ_THIS

> **给接下手的 LLM / 开发者的交接说明。改代码前先读完这一页。**
>
> 最后更新：2026-10-17 · 对应分支：`ios`

---

## 这是什么

ToyDiary 的 **iOS 版**（Capacitor 8 包一层 WKWebView）。Web 端本身是一个 React 19 + Vite
的 SPA，部署在 Cloudflare Pages（`https://toydiary.pages.dev`），业务数据走 localStorage，
AI / 地点走 Pages Functions。

iOS 分支「能编译、能打包」。上一轮清点出的 4 个 **浏览器上正常、装进 WKWebView 就坏掉**
的问题**已在代码里全部处理**，但**一次都没在真机 / CI 上验证过** —— 见下面「未验证」。

---

## 当前状态

### 已验证（Linux 本地能做的部分）

- `npm ci` 干净通过（锁文件与 `package.json` 同步）
- `npm run typecheck`（`tsc -b`）通过，无类型错误
- `npm run build:ios`（= `tsc -b && vite build --mode ios`）通过
- `npm run lint`（oxlint）只有既有的 fast-refresh 警告，本轮改动零新增
- `npx cap sync ios` 通过，`web/ios/App/CapApp-SPM/Package.swift` 里已含
  `CapacitorShare`（3 个插件：camera / filesystem / share）
- 4 个接口的环境变量注入**确实生效** —— 构建产物里能 grep 到绝对地址，无残留相对路径
- 共享 scheme 的 target UUID 与 `project.pbxproj` 一致

### 未验证（别当成已知事实）

- **`xcodebuild archive` 从未真正跑过。** 开发机是 Linux，没有 Xcode。CI 工作流写好了但一次都没执行
- **`SceneDelegate.swift` 里新加的 `recognizeText` 是纯盲写代码** —— Swift 在 Linux 上编译不了，
  语法/API 错误只能在 CI 的 Archive 步骤暴露
- `macos-15` runner 上的 Xcode 版本、Capacitor 8 的最低 Xcode 要求 —— **没查证过**，是按记忆写的
- IPA 能否在真机上安装、装完能否正常启动 —— 全部待验证
- **本轮 4 个修复的真机行为全部未验证**：分享面板是否真弹出、OCR 是否真离线可用、
  对话图片重开 App 后是否还在、备份恢复后对话图是否完好

所以：**第一次跑 CI 大概率要迭代**。日志第一步就是工具链版本，先看那个。

---

## 本轮已修复（4 项，代码已落地，待真机验证）

### 1. ✅ 分享 / 保存 / 导出：曾提示成功但什么都不存

**曾经的根因**（`web/src/share/shareHelpers.ts`）：`isMobileClient()` 是 **UA 正则**，iOS 上返回
true → 走 `navigator.share` 分支 → **WKWebView 没实现它** → 落到 `downloadBlob()`，而
`<a download>` 对 `blob:` URL 在 WKWebView 里是空操作 → 但函数仍然 `return 'downloaded'` →
调用方据此弹「已下载」。三个环节各自看着正常，串起来是静默失败。

**现在的做法**：`shareOrDownloadFile()` 增加 **native 优先分支** ——
`Capacitor.isNativePlatform()` 为真时走 `shareNativeFile()`：blob → 裸 base64
（复用 `photoStorage.ts` 导出的 `fileToBase64`，`Filesystem.writeFile` 不接受 `data:` 前缀）
→ 写入 `Directory.Cache/ToyDiary/share/` → `Filesystem.getUri()` → `Share.share({ files:[uri] })`
弹系统面板，用户可选「存储图像」/「存储到文件」。**失败一定抛出**，不再谎报成功。

返回值类型保持 `'shared' | 'downloaded'` 不变，5 个调用点（`EntryDetailPage` /
`GrowthStatsPage` / `DayCountStudioPage` / `MemoryShareSheet` / `MeSubpages`）
**一个字都没改** —— 它们本来就有 `try/catch` + `showToast(error.message)`，抛错会自动透出。

**注意**：临时文件写在 `Directory.Cache`，靠 iOS 回收，**分享后不立即删**（分享扩展可能还在读）。

### 2. ✅ 拍照识别文字（OCR）：改走原生 Vision

**曾经的根因**（`web/src/ocr/recognizeImageText.ts`）：`createWorker()` 没传
`workerPath` / `corePath` / `langPath`，三者全走 tesseract.js 默认值，**都是 jsdelivr CDN**；
且默认 `workerBlobURL: true`，Capacitor 自定义 scheme 下未必允许 blob: Worker。
断网时这个功能**永远不可能成功**。

**为什么不 vendor**：实测 `tessdata.projectnaptha.com` 上 `chi_sim.traineddata.gz` **20.2MB**、
`eng.traineddata.gz` **10.9MB**，合计 31MB，不可能进仓库。

**现在的做法**：复用项目已有的原生 Vision 先例（抠图）。`SceneDelegate.swift` 的
`ToySubjectPlugin` 加了 `recognizeText` 方法 + `pluginMethods` 条目；TS 侧新增
`web/src/ocr/recognizeImageTextNative.ts`（结构照抄 `removeToyBackgroundNative.ts`）。
`recognizeImageText.ts` 里 native → 原生 Vision，否则 → 原 tesseract 路径。
**签名 `recognizeImageText(image, onProgress)` 未变**，唯一调用点
`components/RecordMethodSheet.tsx` 零改动。

- Vision 文字识别 **iOS 14+**（中文 `zh-Hans` 也是 14+），**不要**照抄抠图的
  `#available(iOS 17.0, *)` 门槛
- 参数：`recognitionLevel = .accurate`、`usesLanguageCorrection = true`、
  `recognitionLanguages = ["zh-Hans", "en-US"]`；复用同一个 `downsampledCGImage(_:)`（已带 EXIF 方向校正）
- 收 `{ dataUrl }`、回 `{ text }`
- **Web 端 tesseract 一行未改** —— 按计划保持原样

### 3. ✅ 对话里的图片消息：从 localStorage 挪到 filesystem

**曾经的根因**：图片以 base64 data URL 进 localStorage，而 iOS WKWebView 配额仅约 5MB。
上限「8MB 文件」→ base64 后约 **10.7MB**，**一张图就必然超**；而 `chatStorage.ts` 把
`QuotaExceededError` **静默吞掉**，用户以为发成功了，重开就没了。

**现在的做法**：

| 位置 | 改动 |
|------|------|
| `web/src/media/photoStorage.ts` | 新增 `CHAT_ROOT = 'ToyDiary/chat'` 与 `persistChatImage` / `getRelativeChatImagePath` / `resolveChatBubbleImageUrl` / `deletePersistedChatImage` / `exportChatImages`；`deleteAllPersistedDiaryPhotos` 与 `importDiaryPhotos` 的可接受 root 各扩一个 |
| `web/src/conversation/chatStorage.ts` | `ChatMessage` 加 `localImagePath?`；`saveChats` **改为返回布尔值**并 `console.error` |
| `web/src/components/ChatImage.tsx`（新） | 挂载时把 `toydiary-media://` 解析成 `Capacitor.convertFileSrc()`，解析不了回落原值；Web 上是直通 |
| `web/src/pages/ConversationPage.tsx` | 选图即落盘（`onImagePicked` 手上就有 `File`）；消息只带稳定引用；两处 `<img>` 换 `<ChatImage>`；`appendMessages` 拿到 `false` 时经 ref + effect 弹 toast（**不在 `setState` 更新函数里抛异常**）；删除消息 / 清空对话 / 放弃待发图片时回收文件 |
| `web/src/share/fullBackup.ts` | `FULL_BACKUP_VERSION` **3 → 4**，`media` 加 `chatImages`；导入侧对缺失的 `chatImages` 容错（1/2/3 版备份照常恢复） |

**关键设计**：在**选图那一刻**落盘，`pendingImage` 直接持有小的引用 ——
这样 `saveChats` **保持同步**，4 个保存点（其中 3 个在 `setState` 更新函数里）
完全不需要异步化改造。

**记忆类消息**（`kind === 'memory'`）也一并修了：存的是 `localDiaryPhotoReference`，
不再是 hydration 后的容器 URL（那个 URL 在 iOS 移动 App 容器后就失效）。
注意它的图属于**日记照片树**（`ToyDiary/photos`），`relativeChatPath` 会拒绝它，
所以删聊天消息不会误删日记照片。

### 4. ✅ 链上确权（Injective SBT）：native 上隐藏入口

**根因**（`web/src/chain/injectiveSbt.ts`）：依赖 `window.ethereum`。WKWebView 没有注入的
provider，也没有 wallet 深链处理，所以 `requestAccount()` 必然抛错。另外区块浏览器链接用
`target="_blank"`，WKWebView 里打不开。

**现在的做法**：`MeSubpages.tsx` 的 `ProfileSettingsPage` 里，整个 SBT `<section>`
套 `!isNativeApp()` 条件渲染，平台一并解决那两条链接。

> **探索发现，与上一版文档记载不符**：这个 catch 所在的 `ProfileSettingsPage`
> **没有被任何路由引用** —— `App.tsx` 从 `MeSubpages` 只导入了
> `DataBackupPage / LegalPage / NotifySoundPage / PreferencesPage / SupportPage /
> ThemePickerPage`，路由表里也没有它，「我的」页也没有指向它的入口。
> **所以这个页面当前根本走不到，用户看不到这个 bug。**
>
> **待你判断**：这个页面是**本来该有路由但漏了**，还是**已废弃**？如果是前者，
> 那真正要修的是少一条路由。

---

## 仍未修复 / 已知遗留

| 项 | 位置 | 说明 |
|----|------|------|
| `communityStore` 同样静默吞配额 | `web/src/api/communityStore.ts` | 它存的是 `Capacitor.convertFileSrc` URL 而非 base64，不占配额，属另一类问题 |
| Unsplash 演示图 | `web/src/api/mockStore.ts`、`web/src/community/communityData.ts` | 离线时裂图，纯演示数据 |
| Google Fonts | `web/index.html` | 离线回落系统字体，不破版 |
| OSM 地图瓦片 | `web/src/pages/TravelMapPage.tsx` | 离线底图空白，已有提示条 + 重试 |
| 孤儿依赖 | 根 `package.json` | `onnxruntime-web` 在 `web/` 里已无任何引用，可清 |

---

## 已经处理好、别重复踩的坑

- **`convertFileSrc`**：日记照片、玩偶头像的 hydration 已接好（`web/src/api/client.ts`）。
  **对话图片没有 hydration 通道**，是 `ChatImage` 组件在挂载时解析 —— 别再往
  `client.ts` 里加聊天的。
- **safe-area**：`web/src/index.css:63-72` 用 `--safe-top: max(50px, env(safe-area-inset-top, 0px))`
  兜住了 WKWebView 把 `env()` 报成 0 的情况。`index.html:9-12` 也有 `viewport-fit=cover`。
  已经在模拟器上验证过，**不要动**。
- **浏览器版图像工具已删干净**：`onnxruntime-web` / `@imgly/background-removal` 在 `web/` 里
  已无任何引用，抠图改走原生 Vision 插件。
- **`IndexedDB` / `navigator.clipboard`**：全仓库没用到，不用管。

---

## iOS 构建链路（改完代码要做什么）

工作流：`.github/workflows/ios-unsigned-ipa.yml`

- **只在 GitHub Actions 页面手动触发**，没有 push / PR / schedule
- **两个通道，都是正式 Release（不是 pre-release）**：

  | 通道 | tag | Release 名 | Latest 徽章 |
  |------|-----|-----------|-------------|
  | `dev` | `ios-dev-v<版本>-b<运行号>` | `Toy Diary iOS DEV · v<版本> (build <run>)` | 不抢 |
  | `stable` | `ios-v<版本>` | `Toy Diary iOS · v<版本>` | 归它 |

  手动传 `tag` 输入时它最高优先，两个通道都适用。
  **stable 的 tag 不含运行号，同版本重发会因 tag 已存在而失败** —— 显式传一个更高的 tag。
- `prerelease: false` + `make_latest: ${{ inputs.channel == 'stable' }}` ——
  **`make_latest` 那行别丢**：GitHub 会把「最近一个非 pre-release」标成 Latest，
  两个通道都不再是 pre-release 之后，dev 会把 Latest 抢走，`false` 让它退出竞争。
- 产物是**未签名** IPA，下载后用 **SideStore** 本地重签安装（免费 Apple ID，7 天过期）
- 详细操作见 [`docs/wiki/14-ios-ipa.md`](docs/wiki/14-ios-ipa.md)

本地改动后要验证 iOS 侧能编译，至少跑：

```bash
cd web
npm ci
npm run typecheck          # tsc -b
npm run build:ios          # tsc -b && vite build --mode ios
npx cap sync ios           # 重新生成 App/App/public 和 SPM 的 Package.swift
```

**三个硬性约束**：

1. **`workflow_dispatch` 的工作流必须存在于默认分支（`main`）**，否则 Actions 页面里
   看不到 Run workflow 按钮。运行时用分支下拉框选 `ios`。改了工作流要**同时推 `ios` 和 `main`**。
2. **不要创建 `.env.ios`。** 该文件名同时被根 `.gitignore`（`**/.env.*`）和
   `scripts/pre-push.sh:65` 的拦截正则挡住，**提交不了**。iOS 需要的 4 个接口变量走
   workflow 的 `env:` 注入（Vite 的 `loadEnv` 会合并 `process.env` 里 `VITE_` 前缀的变量），
   说明写在 `web/env.example.txt`。
3. **加了 Capacitor 插件后必须提交 `web/ios/App/CapApp-SPM/Package.swift`**（它是被跟踪的，
   CLI 生成）。不提交的话 CI 里 SPM 找不到那个包，功能会**静默退回旧行为**。

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
| 最低 iOS | 15.0（**原生抠图需 iOS 17+**，低版本有降级文案；OCR 需 14+，已被 15.0 覆盖） |
| 设备族 | **仅 iPhone**（`TARGETED_DEVICE_FAMILY = 1`）—— 装 iPad 上是放大兼容模式 |
| Capacitor | 8.5.1，**SPM**（不是 CocoaPods，没有 Podfile） |
| 原生插件 | `ToySubjectPlugin`（Vision：抠图 + OCR），注册在 `web/ios/App/App/SceneDelegate.swift` |
| 分享插件 | `@capacitor/share` 8.0.3（本轮新增） |
| 共享 scheme | `web/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`（CI 依赖，别删） |
| 部署目标工程 | `web/ios/App/App.xcodeproj/project.pbxproj` |
| dev 用 Team ID | `X5T88NPQA2`（写在 pbxproj 里；CI 打包时置空） |

---

## 想跑本地热更新

`web/capacitor.config.ts` 里 `server.url` 那两行注释就是给这个用的：先 `npm run dev`，
把 url 改成终端打印的局域网地址，再 `npm run ios:open`。需要一台 Mac。
