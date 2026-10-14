# 14 · iOS 打包与 IPA

> 上级：[Wiki 首页](./README.md) · 相关：[09 · 部署与 Cloudflare](./09-deploy.md)、[12 · 排障手册](./12-troubleshooting.md)

---

## 一句话

在 GitHub Actions 页面**手动点一次**，等 5–10 分钟，`Releases` 里就会出现一个未签名的
`ToyDiary-unsigned.ipa`；下载后用 **SideStore** 在本地用你自己的 Apple ID 重签安装。

---

## 为什么要「未签名」

签名需要苹果签发的证书和私钥。CI 在 GitHub 的机器上跑，拿不到你钥匙串里的东西；
而免费 Apple ID 的签名只能在本地做（SideStore 干的就是这件事）。

所以分工是：

| 环节 | 谁做 | 产出 |
|------|------|------|
| 编译 + 打包 | GitHub Actions（macOS runner） | `ToyDiary-unsigned.ipa` |
| 签名 + 安装 | 你本地的 SideStore | 手机上能打开的 App |

好处是 **CI 侧零证书、零密钥、零费用**。代价是包 7 天过期，需要定期刷新。

---

## 怎么触发

1. 打开仓库 → **Actions** 标签页
2. 左侧选 **「iOS IPA (unsigned, manual)」**
3. 右上角 **Run workflow** → 选 `ios` 分支 → 按需改参数 → 点绿色按钮

这个 workflow **只有手动触发**，没有 `push` / `PR` / `schedule`，不会自己跑。

### 参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `tag` | 留空 | Release 的 tag。留空自动生成 `ios-v<版本>-b<运行号>` |
| `api_base` | `https://toydiary.pages.dev` | 接口基地址。换成 `https://toydiary.outwardly.dpdns.org` 也能用 |
| `prerelease` | `true` | 是否在 Release 上标记 pre-release |

### 产物

- **Releases** 页面：`ToyDiary-unsigned.ipa` + `ToyDiary-unsigned.ipa.sha256`
- 同一次运行的 **Artifacts**：保留 30 天

核对完整性：

```bash
shasum -a 256 -c ToyDiary-unsigned.ipa.sha256
```

---

## 安装（SideStore）

1. 下载 `.ipa` 到手机（AirDrop / iCloud Drive / SideStore 的文件夹都行）
2. SideStore → `+` → 选这个 IPA → 它会用你的免费 Apple ID 重签并安装
3. 首次安装后需要在 **设置 → 通用 → VPN与设备管理** 里信任你的开发者证书

### 7 天过期怎么办

免费 Apple ID 签的包 **7 天后失效**，App 会打不开。在 SideStore 里点刷新续期即可
（SideStore 靠一个本地 VPN 在后台自动续，配好之后基本不用管）。

**这跟 IPA 本身无关** —— 是免费账号的限制，换付费账号就是 1 年。

---

## 构建流程（CI 里发生了什么）

写在 `.github/workflows/ios-unsigned-ipa.yml`，顺序如下：

```
npm ci                    # 先装依赖：SPM 有两个本地包指向 web/node_modules
  ↓
npm run build:ios         # tsc -b && vite build --mode ios
  ↓
npx cap sync ios          # 生成 App/App/public/ 和 capacitor.config.json（这两个被 gitignore）
  ↓
xcodebuild -resolvePackageDependencies -scheme App
  ↓
xcodebuild archive        # 不签名，-destination 'generic/platform=iOS'
  ↓
Payload/App.app → ditto → ToyDiary-unsigned.ipa
  ↓
校验 + sha256 → Artifacts + Releases
```

### 两个容易踩的点

**1. 接口必须指向绝对地址。** WKWebView 的 origin 是 `capacitor://localhost`，
相对路径 `/api/*` 会打到本地空壳。workflow 的「解析接口地址」步骤把 4 个 `VITE_*`
注入 `process.env`，Vite 的 `loadEnv` 会合并它们。

为什么不用 `.env.ios`：该文件名同时被根 `.gitignore`（`**/.env.*`）和
`scripts/pre-push.sh:65` 的拦截正则挡住，**提交不了**。
`web/env.example.txt` 是唯一能提交的环境变量载体。

**2. 必须有不签名的共享 scheme。** `xcodebuild archive` 只认 `-scheme`
（`archive` 动作不支持 `-target`）。工程原本没有
`xcshareddata/xcschemes/`，已补上 `App.xcscheme`。

---

## 工程本身的配置

| 项 | 值 | 位置 |
|----|-----|------|
| Bundle ID | `com.toydiary.app` | `web/capacitor.config.ts` + `project.pbxproj` |
| 最低 iOS | 15.0 | `project.pbxproj` 的 `IPHONEOS_DEPLOYMENT_TARGET` |
| 设备族 | 仅 iPhone（`TARGETED_DEVICE_FAMILY = 1`） | 同上 |
| Capacitor | 8.5.1（**SPM**，不是 CocoaPods） | `web/ios/App/CapApp-SPM/Package.swift` |
| 原生抠图 | `ToySubjectPlugin`，走 Vision，**需 iOS 17+** | `web/ios/App/App/SceneDelegate.swift` |

装到 iPad 上是放大兼容模式，不是原生布局。

---

## 已知限制（装到手机上会遇到的）

按影响排序：

| # | 现象 | 原因 |
|---|------|------|
| 1 | **分享 / 保存 / 导出按钮提示成功，但什么都没存下来** | `web/src/share/shareHelpers.ts:42-86`：WKWebView 没有 `navigator.share`，`a[download]` 对 `blob:` URL 也无效，但函数仍返回 `'downloaded'`。影响日记卡、成长图、纪念图、JSON 备份导出等 5 处调用 |
| 2 | **拍照识别文字（OCR）离线不可用** | `web/src/ocr/recognizeImageText.ts:13-15`：tesseract.js 的 worker / wasm / `chi_sim` 语言包都从 jsdelivr CDN 拉。另外它默认用 `blob:` URL 起 Worker，WKWebView 下未必允许 |
| 3 | **对话里的图片消息重开后消失** | `web/src/conversation/chatStorage.ts:29-31` 静默吞掉 `QuotaExceededError`；图片以 data URL 存 localStorage，超 5MB 配额就丢 |
| 4 | **链上确权（Injective SBT）完全不可用** | `web/src/chain/injectiveSbt.ts:63-68` 需要 `window.ethereum`，WKWebView 里没有注入的 provider。有 toast 提示，不会崩 |
| 5 | 离线时地图底图空白、部分演示图裂图、字体回落系统字体 | OSM 瓦片 / Unsplash 图 / Google Fonts 都是远程资源，均有兜底 |

第 5 项之外的问题都还没修 —— 本次只做了「能打出 IPA」这件事。

---

## 排障

| 报错 | 原因 / 处理 |
|------|-------------|
| `npm ci` 失败 | `web/package-lock.json` 与 `package.json` 不同步。本地跑 `npm install` 更新锁文件后提交 |
| `does not contain a scheme named "App"` | 共享 scheme 没提交或被删。确认 `web/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` 在仓库里 |
| SPM 报找不到 `CapacitorCamera` / `CapacitorFilesystem` | `npm ci` 没跑或跑在 `cap sync` 之后。SPM 有本地包指向 `web/node_modules` |
| 编译报工具链错误 / Swift 版本不认 | runner 的 Xcode 版本不对。看日志开头的「诊断 · 工具链版本」步骤，必要时改 `runs-on` 或 pin Xcode |
| Release 步骤 403 | workflow 少了 `permissions: contents: write` |
| 装到手机后接口全挂 | `api_base` 填错，或 Pages Functions 改了路径。在浏览器里 `curl <api_base>/api/places/search?q=大理` 验证 |

**日志在哪看**：Actions → 选那次运行 → 点进 `Build unsigned IPA` job。第一步就是工具链版本，
archive 的完整输出在「Archive（unsigned）」；产物信息（Bundle ID / 版本 / 最低 iOS）在
那次运行的 Summary 页。

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `.github/workflows/ios-unsigned-ipa.yml` | 构建 workflow |
| `web/ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` | 共享 scheme（CI 依赖） |
| `web/capacitor.config.ts` | appId / appName / webDir |
| `web/env.example.txt` | iOS 构建需要的 4 个环境变量说明 |
| `web/ios/App/App/Info.plist` | 权限文案、显示名 |
| `web/ios/App/App/SceneDelegate.swift` | 原生抠图插件 |
