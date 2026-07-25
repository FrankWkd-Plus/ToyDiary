# Ring Sound 戒指：连接与使用指南

本文面向**第一次接触语音戒指**的开发者与测试同学，用中文说明如何开机、连接、操作设备，以及如何用本仓库提供的工具收录音、看 IMU / 手势。

更细的 API 参数、协议字段与音频格式，请继续查阅：

| 文档 | 用途 |
| --- | --- |
| [README.md](README.md) | 架构、协议边界、录音编码格式 |
| [ring_sound_use.md](ring_sound_use.md) | Python SDK 完整调用手册 |
| [ring_sound_swift_use.md](ring_sound_swift_use.md) | Swift Package（iOS/macOS）用法 |
| [protocol.md](protocol.md) | v4 协议字段表 |
| [attention.md](attention.md) | Apple 平台注意点 |

**版本基线**

- 仓库发行版：`v2.0.0`
- Python SDK：`ring_sound.py` `0.4.1`
- Swift Package：iOS 15+ / macOS 12+ / Swift 5.9+
- 通信协议：语音戒指 v4
- 参考固件：`V2.000.0001.0015`

---

## 1. 设备能做什么

Ring Sound 是一枚通过 **蓝牙 BLE + Nordic UART Service（NUS）** 通信的语音戒指，主要能力：

1. **录音**：长按录音，松开后保存；可通过 BLE 下载原始 Speex 流并解码为 WAV。
2. **手势**：进入手势模式后，长按可做 HMM 手势识别（旋转、挥动等）。
3. **六轴 IMU**：在手势模式下，可开启实时加速度 / 陀螺仪批量上报。
4. **系统信息**：电量、固件版本、序列号、录音存储空间等。

连接方式有三种常用入口：

| 方式 | 适合谁 | 入口 |
| --- | --- | --- |
| Android 演示 App | 快速验证硬件、听录音、看 IMU / 手势 | 本目录 `demo.apk` |
| Python SDK | Windows / Linux / macOS 脚本与后端 | `ring_sound.py` |
| Swift SDK | iOS / macOS App 集成 | `Package.swift` + `Sources/RingSound/` |

---

## 2. 上手前准备

### 2.1 硬件与环境

- 戒指电量建议 **≥ 20%**。电量过低时，固件会拒绝开始录音或手势，并红灯闪烁报错。
- 电脑 / 手机打开蓝牙；尽量避免其他 App 独占连接同一枚戒指。
- 戒指靠近主机，减少金属遮挡与 2.4 GHz 干扰。
- 首次使用建议先用 `demo.apk` 或 `python ring_sound.py scan` 确认本机能扫描到设备。

### 2.2 按键与工作模式（必读）

设备只有 **一个物理按键**，内部维护两种工作模式：

| 模式 | 开机默认 | 本地 IMU | 长按行为 |
| --- | --- | --- | --- |
| **录音模式** | 是 | 关闭 | 开始 / 结束录音 |
| **手势模式** | 否 | 开启 | 开始 / 结束 HMM 手势会话 |

**重要限制：当前协议不能主动查询或远程切换模式。**  
模式只能靠按键在设备本地切换；App / SDK 只能接收事件，再结合初始状态与后续行为推断。

| 用户操作 | 判定条件（固件侧） | 协议事件 | 结果 |
| --- | --- | --- | --- |
| **单击** | 按下 < 200 ms；消抖 50 ms；松手后再等 500 ms 双击窗口 | `0x0704` | 尝试在录音 ↔ 手势模式间切换 |
| **双击** | 第二次短按落在第一次松手后 500 ms 内 | `0x0703` | **不切换模式**，也不再发对应 `0x0704` |
| **长按** | 按住超过 300 ms | 无独立“长按开始”事件 | 录音模式 → 录音；手势模式 → 手势会话 |
| **长按松开** | — | 录音数据或 `0x0702` | 结束当前会话，模式本身不变 |

注意：

- 收到 `0x0704` **只表示识别到单击**，不保证模式切换成功（设备忙碌、IMU 启动失败、长按收尾 250 ms 抑制窗口内都可能失败）。
- 长按会话期间会抑制普通双击 `0x0701`。
- 双击成立时不会再触发单击，因此也不会切换模式。

### 2.3 LED 灯效怎么看

空闲时的“录音模式 / 手势模式”**没有常亮指示灯**。灯主要表示**正在进行的操作或错误**：

| 现象 | 含义 |
| --- | --- |
| **绿灯常亮** | 正在录音；或充电完成 |
| **红灯常亮** | 手势长按会话进行中 |
| **红灯闪 3 次**（约 100 ms 亮灭） | 本次操作失败（模式切换 / 录音 / 手势启动失败，常见原因含电量 < 20%） |
| **红灯约 500 ms 亮灭交替** | 正在充电 |

“手势进行中”和“错误”都偏红：用 **常亮** 与 **闪三下** 区分。

### 2.4 手势 ID 含义

| `gesture_id` | 名称 | 说明 |
| ---: | --- | --- |
| 0 | `idle` | 空闲 / 未识别 |
| 1 | `rotate_back` | 向后旋转 |
| 2 | `rotate_front` | 向前旋转 |
| 3 | `wave` | 挥动 |

Python：`sdk.sensor_gesture_name(id)`  
Swift：`RingSoundParsers.gestureName(id)`

---

## 3. 用 Android 演示 App 快速体验

目录内提供 `demo.apk`（独立 Android 交付物，**不是** Python SDK 依赖）。

| 项目 | 值 |
| --- | --- |
| 应用名 | `bluetest` |
| 版本 | `5.0.1` |
| 页面标题 | 语音单个功能测试 |
| 作用 | 蓝牙连接设备、提取 / 播放原始录音、查看 IMU 与手势 |

**步骤建议**

1. 将 `demo.apk` 安装到已开启蓝牙的 Android 手机（需允许未知来源安装，并授予蓝牙 / 附近设备 / 位置相关权限）。
2. 打开 App，扫描并连接戒指。
3. 按第 2 节说明操作按键：录音模式下长按录音；单击切到手势模式后可测手势与 IMU。
4. 验证通过后再接 Python / Swift 做正式集成。

安装前请确认文件来源。当前仓库记录的 SHA-256 为：

```text
3952650E9B339746D30C7D23B9F65790BAEB69A69460649564FEEB78B21D10FF
```

> APK 界面上的功能名 **不能** 直接等同于 Python `ring_sound.py.__all__` 公开 API。

---

## 4. 用 Python 连接与使用

### 4.1 环境安装

推荐 Python **3.11+**。

```powershell
# 1. 把 ring_sound.py 放到你的项目目录
# your_project/
#   ring_sound.py
#   main.py

# 2. 安装 BLE 依赖
python -m pip install bleak

# 3. 若需要把录音解码成 WAV，再安装 ffmpeg，并保证命令行可执行
ffmpeg -version
```

只下载原始 `.bin`、不解码时，可以不装 `ffmpeg`。

**Windows**

- 打开系统蓝牙；避免其他 BLE 工具占用戒指。
- 能扫到但连不上时：开关蓝牙、断开其他连接、重启戒指广播。

**Ubuntu / Linux**

- 需要 BlueZ，并确认当前用户有蓝牙权限。

### 4.2 先扫描，拿到 MAC 地址

Python / bleak 使用 **BLE MAC 地址**（例如 `F1:C1:8A:35:40:FB`）标识设备，不依赖广播名。

命令行：

```powershell
python ring_sound.py scan
# 或过滤某一地址
python ring_sound.py scan --address F1:C1:8A:35:40:FB
```

脚本：

```python
import asyncio
import ring_sound as sdk


async def main() -> None:
    devices = await sdk.scan_rings(timeout_s=25.0)
    for d in devices:
        print(d.name, d.address, d.rssi)


asyncio.run(main())
```

默认扫描最长 **25 秒**。把输出里的 `address` 记下来，后面所有连接都用它。

### 4.3 最小连接：读系统信息

把地址换成你的戒指：

```python
import asyncio
import ring_sound as sdk

ADDRESS = "F1:C1:8A:35:40:FB"


async def main() -> None:
    async with sdk.RingSoundClient(address=ADDRESS) as ring:
        info = await sdk.get_system_info(ring)
        print("固件:", info.firmware_version)
        print("电量:", info.battery_percent, "%", "充电中" if info.battery_charging else "")
        print("序列号:", info.sn)
        print("型号:", info.model)
        print("录音存储剩余:", info.audio_storage_available, "/", info.audio_storage_total)


if __name__ == "__main__":
    asyncio.run(main())
```

命令行等价：

```powershell
python ring_sound.py info --address F1:C1:8A:35:40:FB
```

也可用 `connect_ring()`，但要自己 `disconnect()`：

```python
ring = await sdk.connect_ring(ADDRESS, auto_time_sync=True)
try:
    info = await sdk.get_system_info(ring)
finally:
    await ring.disconnect()
```

### 4.4 推荐业务流程

#### A. 下载设备里已有录音并生成 WAV

```text
连接 → get_audio_file_count → download_audio_file → save_audio_bundle
```

```python
async with sdk.RingSoundClient(address=ADDRESS) as ring:
    count = await sdk.get_audio_file_count(ring)
    print("录音数量:", count)
    if count:
        info, raw = await sdk.download_audio_file(ring, file_index=0)
        bundle = sdk.save_audio_bundle(
            file_index=info.file_index,
            data=raw,
            metadata={"record_time": info.record_time},
            output_dir="audio",
        )
        print("原始文件:", bundle.raw_path)   # .bin，Speex 流
        print("可播放:", bundle.play_path)    # .wav
```

命令行：

```powershell
python ring_sound.py audio-count --address F1:C1:8A:35:40:FB
python ring_sound.py audio-download --address F1:C1:8A:35:40:FB 0 audio\rec0
```

说明：

- `file_index` 从 **0** 开始。
- 默认走 **quick** 下载链路（`0x0509 → 0x0504 → 0x0505...`），缺帧会自动 `0x0506` 补传。
- `.bin` **不能直接当音频播放**，必须解码。

#### B. 边连边录：接收刚录完的自动上报

设备在录音**保存成功后**会主动连发 `0x0505`（不会先发 `0x0504`）。

```text
连接 → receive_auto_audio_file 等待
     → 用户在录音模式下长按录音并松开
     → 保存成功后自动上报 → save_audio_bundle
```

```python
async with sdk.RingSoundClient(address=ADDRESS) as ring:
    print("请确认戒指处于录音模式，然后长按录音，完成后松开")
    file_index, raw = await sdk.receive_auto_audio_file(ring, timeout_s=60.0)
    bundle = sdk.save_audio_bundle(
        file_index=file_index,
        data=raw,
        output_dir="audio",
    )
    print(bundle.raw_path, bundle.play_path)
```

注意：

- 等待期间必须保持 BLE 已连接。
- **不要**与 `download_audio_file()` / `read_audio_frame()` 并发消费同一连接的 `0x0505` 队列。
- 若连上太晚错过主动上报，改用 `get_audio_file_count` + `download_audio_file`。

#### C. 实时六轴 IMU

```text
连接 → 用户单击切到手势模式 → start_sensor_report
     → 循环 wait_sensor_data → stop_sensor_report
```

```python
async with sdk.RingSoundClient(address=ADDRESS) as ring:
    print("请单击戒指，尝试进入手势模式（红灯错误闪烁则失败）")
    press = await sdk.wait_sensor_key_single_press_event(ring, timeout_s=30.0)
    print("单击时间戳 ms:", press.timestamp_ms)

    start = await sdk.start_sensor_report(ring)
    print("采样率:", start.sample_rate_hz)
    try:
        for _ in range(10):
            batch = await sdk.wait_sensor_data(ring, timeout_s=5.0)
            for s in batch.samples:
                print(batch.sequence_start, s.timestamp_ms, s.accel_x, s.gyro_x)
    finally:
        await sdk.stop_sensor_report(ring)
```

要点：

- `start_sensor_report()` **只打开 BLE 上报开关**，不会替你把手势模式打开。
- 仍在录音模式时调用，设备会返回 busy。
- `wait_sensor_data()` 不会自动发 `0x0601`。

#### D. 接收 HMM 手势

```text
连接 → 确认手势模式 → 用户长按、完成动作、松开 → wait_sensor_gesture_event
```

```python
async with sdk.RingSoundClient(address=ADDRESS) as ring:
    print("请确保处于手势模式，然后长按完成手势并松开")
    event = await sdk.wait_sensor_gesture_event(ring, timeout_s=30.0)
    print(event.gesture_id, sdk.sensor_gesture_name(event.gesture_id))
```

手势识别用设备内部 IMU，**不要求**先 `start_sensor_report()`。只有还要实时 `0x0605` 时才开上报。

#### E. 自动校时

设备会主动发 `0x0401` 请求时间，SDK 可自动回 `0x0402`：

```python
async with sdk.RingSoundClient(address=ADDRESS) as ring:
    sdk.enable_time_sync(ring)
    await asyncio.sleep(60)  # 保持连接
```

```powershell
python ring_sound.py time-sync --address F1:C1:8A:35:40:FB --seconds 30
```

#### F. 清空全部录音（破坏性）

```python
await sdk.clear_audio_files(ring)
```

```powershell
python ring_sound.py audio-clear --address F1:C1:8A:35:40:FB --yes
```

没有 `--yes` 时命令行会拒绝执行。

### 4.5 常用命令行一览

```powershell
python ring_sound.py scan
python ring_sound.py connect --address <MAC>
python ring_sound.py info --address <MAC>
python ring_sound.py time-sync --address <MAC> --seconds 30
python ring_sound.py audio-count --address <MAC>
python ring_sound.py audio-download --address <MAC> <file_index> <output路径>
python ring_sound.py audio-decode <input.bin> <output.wav>
python ring_sound.py audio-clear --address <MAC> --yes
python ring_sound.py log-storage --address <MAC>
python ring_sound.py log-read --address <MAC> <index> <offset> <size> --text
```

### 4.6 传输与迁移注意

- 向戒指 NUS RX 写入时，SDK **固定按 20 字节分片**（最后一片可更短）。这不是 MTU 协商关闭。
- 从 0.3.x 升级时，请移除自定义的 `write_chunk_size` / `write_chunk_size` 参数。
- 戒指发来的通知长度不限 20 字节，由 `PacketStream` 按 v4 包头重组。

---

## 5. 用 Swift（iOS / macOS）连接与使用

### 5.1 添加到工程

Xcode：

```text
File → Add Package Dependencies... → Add Local...
→ 选择包含 Package.swift 的本目录
→ 把 RingSound library 加到 App target
```

或依赖 GitHub Release：

```swift
dependencies: [
    .package(
        url: "https://github.com/AdvxPlora2026/zilo-whisper-ring-sdk.git",
        from: "2.0.0"
    ),
],
targets: [
    .target(name: "YourAppCore", dependencies: ["RingSound"]),
]
```

```swift
import RingSound
```

### 5.2 Apple 平台差异

1. **设备标识不是 MAC**  
   CoreBluetooth 不暴露 BLE MAC。Swift 版用 `CBPeripheral.identifier` 的 **UUID**。  
   `BLEDeviceInfo.address` 字段名保留是为了迁移，实际存的是 UUID 字符串。

2. **权限**  
   iOS `Info.plist`：

   ```xml
   <key>NSBluetoothAlwaysUsageDescription</key>
   <string>用于连接 Ring Sound 戒指并读取录音与传感器数据</string>
   ```

   macOS 若开了 App Sandbox，需启用 Bluetooth entitlement：

   ```xml
   <key>com.apple.security.device.bluetooth</key>
   <true/>
   ```

3. **Speex 解码**  
   - macOS：可用 PATH 中的 `ffmpeg`，或指定 `ffmpegPath`。  
   - iOS：不能起外部进程，需注入原生 `SpeexDecoder`。  
   - 只下载原始 `.bin` 不需要解码器。

4. **写入分片**  
   与 Python 0.4.1 一致，固定 20 字节；旧版 `writeChunkSize` 参数已移除。

### 5.3 最小连接示例

```swift
import Foundation
import RingSound

func readRingInfo() async throws {
    let devices = try await scanRings(timeout: 25)
    guard
        let device = devices.first,
        let identifier = UUID(uuidString: device.address)
    else {
        print("未发现 Ring Sound 设备")
        return
    }

    let ring = RingSoundClient(identifier: identifier)
    try await ring.connect()
    defer { Task { await ring.disconnect() } }

    let info = try await ring.getSystemInfo()
    print("firmware:", info.firmwareVersion)
    print("battery:", info.batteryPercent)
    print("serial:", info.serialNumber)
}
```

已保存过 peripheral UUID 时：

```swift
let ring = try await connectRing(
    identifier: savedPeripheralIdentifier,
    commandTimeout: 10,
    autoTimeSync: true
)
```

### 5.4 录音 / IMU / 手势（与 Python 同语义）

**下载录音：**

```swift
let count = try await ring.getAudioFileCount()
guard count > 0 else { return }

let downloaded = try await ring.downloadAudioFile(fileIndex: 0) { received, total in
    print("\(received)/\(total)")
}
try downloaded.data.write(to: rawOutputURL)
```

**接收刚录完的自动推送：**

```swift
print("请长按录音后松开")
let recording = try await ring.receiveAutoAudioFile(timeout: 60)
try recording.data.write(to: rawOutputURL)
```

**macOS 保存 bin + wav：**

```swift
let bundle = try AudioCodec.saveAudioBundle(
    fileIndex: downloaded.info.fileIndex,
    data: downloaded.data,
    recordTime: downloaded.info.recordTime,
    outputDirectory: outputDirectoryURL
)
print(bundle.rawURL, bundle.playableURL)
```

**六轴与事件：** 同样要求先处于手势模式，再 `startSensorReport()`；`waitForGestureEvent` 不强制先开实时上报。详细示例见 [ring_sound_swift_use.md](ring_sound_swift_use.md)。

### 5.5 错误类型（Swift）

```swift
do {
    _ = try await ring.getSystemInfo()
} catch let RingSoundError.device(code, message) {
    print("设备错误", code, message)
} catch let RingSoundError.timeout(command) {
    print(String(format: "命令 0x%04X 超时", command))
} catch let RingSoundError.protocolError(message) {
    print("协议错误", message)
} catch let RingSoundError.transport(message) {
    print("蓝牙错误", message)
} catch {
    print(error)
}
```

---

## 6. 推荐操作剧本（硬件 + 软件）

### 剧本 1：第一次确认硬件活着

1. 给戒指充电到绿灯常亮或电量充足。  
2. 手机装 `demo.apk`，或电脑 `python ring_sound.py scan`。  
3. 连接后读系统信息，确认固件、电量、SN。  
4. 录音模式长按几秒 → 松开 → 等绿灯灭 → 下载 / 播放录音。

### 剧本 2：录一段并在电脑里听

1. 确认当前是**录音模式**（不确定时：注意单击会尝试切换；若红灯闪 3 次可能失败，可再试或结合业务侧推断）。  
2. **长按**开始录音（绿灯常亮）→ 说话 → **松开**结束。  
3. 已连接时用 `receive_auto_audio_file` / `receiveAutoAudioFile` 即时收；或稍后 `audio-download`。  
4. 用 `save_audio_bundle` / `AudioCodec.saveAudioBundle` 得到 `.wav` 播放。

### 剧本 3：测手势与 IMU

1. **单击**尝试进入手势模式（不要双击）。  
2. 长按做旋转 / 挥动，松手后应收到 `0x0702`（`rotate_back` / `rotate_front` / `wave` 等）；会话中红灯常亮。  
3. 若还要实时六轴：`start_sensor_report` → 循环 `wait_sensor_data` → `stop_sensor_report`。  
4. 再单击可尝试切回录音模式。

### 剧本 4：联调时保持时间同步

连接后尽早 `enable_time_sync` / `enableTimeSync`，并保持会话一段时间，便于设备对时。

---

## 7. 常见问题

### 扫不到设备

- 蓝牙是否打开、戒指是否在广播、距离是否过远。  
- 是否被手机或其他电脑占着连接。  
- Windows 可开关蓝牙；Linux 查 BlueZ 权限。  
- 拉长扫描时间（默认 25 s）。

### 能扫到但连不上

- 断开其他 BLE 工具，重启戒指广播，再连。  
- Python 会先按地址扫描，失败再尝试直接地址连接；仍失败会抛 `TransportError`。  
- iOS 注意权限文案与首次授权弹窗。

### 下载了 `.bin` 但播不了

正常现象。`.bin` 是「2 字节小端长度 + Speex payload」连续流，不是 WAV。请用 SDK 解码，并确认已安装 `ffmpeg`（macOS / 桌面 Python）或注入了 iOS 原生解码器。

### 开启 IMU 报设备忙 / 超时

设备仍在**录音模式**，或本地 IMU 未成功启动。先单击切到手势模式，确认后再 `start_sensor_report`。不要把一次 `0x0704` 当成切换成功的保证。

### 收到一串没有文件信息的 `0x0505`

这是录音保存后的**自动上报**，用 `receive_auto_audio_file`，不要当成 `download_audio_file` 的 quick 链路。

### 录音或手势启动立刻失败（红灯闪三下）

优先检查电量是否 < 20%，以及当前是否已在另一会话中。

### 清空录音后数量仍不对 / 下载报文件不存在

确认 `file_index` 从 0 起、先 `get_audio_file_count`；清空是破坏性操作且需显式确认。

### Swift 里 address 和 Python 不一样

预期差异：Python 是 MAC，Swift 是 peripheral UUID。跨平台不要混用同一字符串当设备主键。

---

## 8. 仓库其它资源

| 路径 | 说明 |
| --- | --- |
| `demo.apk` | Android 功能测试包 |
| `戒指打印模型/` | 外壳 / 按键 / 内环 STEP 模型（`7` / `9` / `10` / `11` 为分组号，**不是**标准指围尺码） |
| `Tests/` | Swift 单元测试（`swift test`） |

打印或加工前，请在 CAD 中自行确认单位、比例、公差与装配间隙。机械模型与软件 API 无关。

---

## 9. 一句话流程总结

```text
充电 → 打开主机蓝牙
  → scan 拿到地址（Python: MAC / Apple: UUID）
  → connect
  → get_system_info 确认设备
  → 按键：单击切换模式；长按在录音模式录音 / 在手势模式做手势
  → 下载或接收录音 → 解码为 WAV
  → （可选）手势模式下开 IMU 上报
  → disconnect
```

若你只想**最快验证一枚新戒指**：装 `demo.apk`，或执行：

```powershell
python -m pip install bleak
python ring_sound.py scan
python ring_sound.py info --address <你的MAC>
```

需要完整 API 细节时，再打开 [ring_sound_use.md](ring_sound_use.md) 或 [ring_sound_swift_use.md](ring_sound_swift_use.md)。
