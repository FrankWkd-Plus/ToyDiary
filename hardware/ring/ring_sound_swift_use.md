# Ring Sound Swift SDK 使用说明

本目录现在同时提供：

- 仓库发行版：`v2.0.0`
- Python 原版：`ring_sound.py` 0.4.1
- Swift Package：`Package.swift` 与 `Sources/RingSound/`

Swift 版覆盖 Python SDK 的 BLE/NUS 通信、v4 二进制协议、系统信息、日志、校时、录音接收/下载/清空、六轴数据、动作事件以及 Speex/Ogg/PCM/WAV 工具。目标平台为：

- iOS 15 或更新版本
- macOS 12 或更新版本
- Swift 5.9 或更新版本

## 1. 添加到 Xcode

在 Xcode 中选择：

```text
File
-> Add Package Dependencies...
-> Add Local...
-> 选择包含 Package.swift 的当前目录
```

把 `RingSound` library product 添加到 App target，然后：

```swift
import RingSound
```

另一个 Swift Package 可以直接引用 GitHub Release 对应的 tag：

```swift
dependencies: [
    .package(
        url: "https://github.com/AdvxPlora2026/zilo-whisper-ring-sdk.git",
        from: "2.0.0"
    ),
],
targets: [
    .target(
        name: "YourAppCore",
        dependencies: ["RingSound"]
    ),
]
```

本地开发时也可以暂时改用 `.package(path: "../zilo-whisper-ring-sdk")`。

## 2. Apple 平台与 Python 版的关键差异

### 2.1 设备标识不是 MAC 地址

Python/bleak 版使用类似 `F1:C1:8A:35:40:FB` 的 BLE MAC 地址。Apple 的 CoreBluetooth API 不向应用提供该 MAC 地址，Swift 版使用 `CBPeripheral.identifier` 对应的 UUID：

```swift
let devices = try await scanRings(timeout: 25)
for device in devices {
    print(device.name ?? "unknown", device.address, device.rssi ?? 0)
}

guard
    let first = devices.first,
    let identifier = UUID(uuidString: first.address)
else {
    return
}
```

`BLEDeviceInfo.address` 为了便于从 Python 版迁移而保留了原字段名，但在 Apple 平台中保存的是这个 UUID。

### 2.2 蓝牙权限

iOS App 的 `Info.plist` 需要提供用户可读的蓝牙用途说明：

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>用于连接 Ring Sound 戒指并读取录音与传感器数据</string>
```

macOS App 如果启用 App Sandbox，还需要在 target 的 Signing & Capabilities 中允许 Bluetooth；对应 entitlement 为：

```xml
<key>com.apple.security.device.bluetooth</key>
<true/>
```

### 2.3 Speex 解码

戒指返回的 `.bin` 是连续的“小端 `UInt16` 帧长 + Speex payload”，并不是可直接播放的音频文件。

- macOS：`AudioCodec` 默认可以调用 PATH 中的 `ffmpeg`，也可以通过 `ffmpegPath` 指定可执行文件。
- iOS：App 不能启动外部 `ffmpeg` 进程，需要把一个原生 Speex C/C++ 库封装成 `SpeexDecoder` 闭包传给 SDK。
- 下载原始 `.bin` 不依赖解码器。
- `buildOggSpeex`、`buildWAV` 等容器工具完全使用 Swift，不依赖 ffmpeg。

### 2.4 NUS 写入分片

Swift v2.0.0 与 Python 0.4.1 一致：发往戒指的 NUS 数据固定按 20 字节分片，最后一片按实际剩余长度发送。`NusClient` 和 `RingSoundClient` 初始化器不再提供 `writeChunkSize` 参数；从旧版迁移时请直接移除该参数。

这个限制只作用于写入。戒指发来的通知仍可能是任意长度，SDK 会通过 `PacketStream` 自动重组完整 v4 协议包。

## 3. 最小连接示例

```swift
import Foundation
import RingSound

func readRingInfo() async throws {
    let devices = try await scanRings()
    guard
        let device = devices.first,
        let identifier = UUID(uuidString: device.address)
    else {
        print("未发现 Ring Sound 设备")
        return
    }

    let ring = RingSoundClient(identifier: identifier)
    try await ring.connect()

    do {
        let info = try await ring.getSystemInfo()
        print("firmware:", info.firmwareVersion)
        print("battery:", info.batteryPercent)
        print("serial number:", info.serialNumber)
        await ring.disconnect()
    } catch {
        await ring.disconnect()
        throw error
    }
}
```

如果已经保存过扫描得到的 UUID，可以直接连接：

```swift
let ring = try await connectRing(
    identifier: savedPeripheralIdentifier,
    commandTimeout: 10,
    autoTimeSync: true
)
```

## 4. 系统信息、日志与校时

### 系统信息

```swift
let info = try await ring.getSystemInfo(timeout: 5)

print(info.firmwareVersion)
print(info.systemTime)
print(info.audioStorageTotal)
print(info.audioStorageAvailable)
print(info.batteryPercent)
print(info.batteryCharging)
print(info.serialNumber)
print(info.cpuID)
print(info.model)
```

### 读取日志

```swift
let storage = try await ring.getLogStorage()
let data = try await ring.readLogChunk(
    index: 0,
    offset: 0,
    size: storage.pageSize
)
print(String(decoding: data, as: UTF8.self))
```

### 自动校时

```swift
let token = await ring.enableTimeSync()

// 保持连接。以后如果不再自动回应：
await ring.removePacketHandler(token)
```

手动响应 `0x0401`：

```swift
let packet = try await ring.waitForCommand(TimeCommand.request)
var reader = BinaryReader(packet.body)
let requestTime = try reader.readUInt32()
try await ring.sendTimeResponse(requestTime: requestTime)
```

## 5. 录音

### 查询并下载指定录音

默认使用 quick 链路 `0x0509 -> 0x0504 -> 0x0505...`：

```swift
let count = try await ring.getAudioFileCount()
guard count > 0 else {
    print("设备中没有录音")
    return
}

let downloaded = try await ring.downloadAudioFile(
    fileIndex: 0,
    progress: { received, total in
        let percent = total > 0 ? received * 100 / total : 0
        print("\(received)/\(total) (\(percent)%)")
    }
)

try downloaded.data.write(to: rawOutputURL)
print(downloaded.info.recordTime)
print(downloaded.info.dataSize)
```

需要验证普通逐帧链路时：

```swift
let downloaded = try await ring.downloadAudioFile(
    fileIndex: 0,
    quick: false
)
```

### 接收刚录完后设备主动推送的数据

调用时必须已经连接，并在等待期间保持连接：

```swift
print("请长按戒指录音，结束后松开")
let recording = try await ring.receiveAutoAudioFile(timeout: 60)
print("file index:", recording.fileIndex)
try recording.data.write(to: rawOutputURL)
```

不要同时调用以下接口，因为它们都会消费 `0x0505` 队列：

- `receiveAutoAudioFile`
- `downloadAudioFile`
- `readAudioFrame`

### 清空全部录音

这是破坏性操作：

```swift
try await ring.clearAudioFiles()
```

### macOS 保存 `.bin + .wav`

确认终端可执行 `ffmpeg` 后：

```swift
let bundle = try AudioCodec.saveAudioBundle(
    fileIndex: downloaded.info.fileIndex,
    data: downloaded.data,
    recordTime: downloaded.info.recordTime,
    outputDirectory: outputDirectoryURL
)

print(bundle.rawURL)
print(bundle.playableURL)
```

指定 ffmpeg：

```swift
let wav = try AudioCodec.decodeAudioToWAV(
    downloaded.data,
    ffmpegPath: "/opt/homebrew/bin/ffmpeg"
)
```

### iOS 注入原生 Speex 解码器

把所选 Speex 库封装为下面的闭包形式：

```swift
let decoder: SpeexDecoder = { encodedData, options in
    let pcmData = try NativeSpeexBridge.decode(
        encodedData,
        sampleRate: options.pcmConfig.sampleRate,
        channels: options.pcmConfig.channels,
        bitDepth: options.pcmConfig.bitDepth
    )
    return SpeexDecodeResult(
        pcmData: pcmData,
        pcmConfig: options.pcmConfig,
        sourceType: "native-speex",
        sourceExtension: "spx"
    )
}

let wav = try AudioCodec.decodeAudioToWAV(
    downloaded.data,
    decoder: decoder
)
```

`NativeSpeexBridge` 代表应用选择并封装的原生解码库，不是 RingSound 包内置类型。

## 6. 六轴数据和动作事件

实时 IMU 的设备端前置条件与 Python 版相同：戒指必须先处于手势模式，然后才能成功开启 `0x0605` 上报。

```swift
let start = try await ring.startSensorReport()
print(start.sampleRateHz)
print(start.accelerationRangeG)
print(start.gyroscopeRangeDPS)

do {
    for _ in 0..<10 {
        let batch = try await ring.waitForSensorData(timeout: 5)
        for sample in batch.samples {
            print(
                batch.sequenceStart,
                sample.timestampMilliseconds,
                sample.accelerationX,
                sample.gyroscopeX
            )
        }
    }
    _ = try await ring.stopSensorReport()
} catch {
    _ = try? await ring.stopSensorReport()
    throw error
}
```

动作事件：

```swift
let doubleTap = try await ring.waitForDoubleTapEvent(timeout: 30)
print(doubleTap.timestampMilliseconds)

let gesture = try await ring.waitForGestureEvent(timeout: 30)
print(
    gesture.gestureID,
    RingSoundParsers.gestureName(gesture.gestureID)
)

let keyDouble = try await ring.waitForKeyDoublePressEvent(timeout: 30)
let keySingle = try await ring.waitForKeySinglePressEvent(timeout: 30)
```

`waitForGestureEvent` 不要求先调用 `startSensorReport`。只有应用还需要实时 `0x0605` 数据时，才需要开启实时上报。

## 7. 协议与音频工具

### 协议包

```swift
let encoded = RingSoundProtocol.encodePacket(
    command: AudioCommand.getList.rawValue
)
let decoded = try RingSoundProtocol.decodePacket(encoded)
print(decoded.command)
```

### BLE 分片重组

```swift
var stream = PacketStream()
let packetsFromFirstChunk = try stream.feed(chunk1)
let packetsFromSecondChunk = try stream.feed(chunk2)
```

### 二进制包体

协议普通整数使用大端序：

```swift
var writer = BinaryWriter()
writer.writeUInt16(0)
writer.writeUInt32(fileIndex)

var reader = BinaryReader(responseBody)
let errorCode = try reader.readUInt16()
let value = try reader.readUInt32()
```

### 离线音频

```swift
let packets = AudioCodec.parsePacketizedSpeex(rawData)
let ogg = try AudioCodec.buildOggSpeex(packets: packets ?? [])
let wav = AudioCodec.buildWAV(pcm: pcmData)
```

## 8. 错误处理

Swift 版把 Python 的异常层次合并为带关联值的 `RingSoundError`：

```swift
do {
    let info = try await ring.getSystemInfo()
    print(info)
} catch let RingSoundError.device(code, message) {
    print("设备错误:", code, message)
} catch let RingSoundError.timeout(command) {
    print(String(format: "命令 0x%04X 超时", command))
} catch let RingSoundError.protocolError(message) {
    print("协议错误:", message)
} catch let RingSoundError.transport(message) {
    print("蓝牙错误:", message)
} catch {
    print(error)
}
```

可匹配的 case：

- `.transport(String)`
- `.protocolError(String)`
- `.timeout(command: UInt16)`
- `.device(code: UInt16, message: String)`
- `.audioDecode(String)`
- `.speexDecoderUnavailable(String)`

## 9. Python API 到 Swift API 对照

| Python 0.4.1 | Swift v2.0.0 |
| --- | --- |
| `scan_rings()` | `scanRings()` |
| `connect_ring()` | `connectRing()` |
| `NusClient` | `NusClient`（CoreBluetooth） |
| `RingSoundClient` | `RingSoundClient` actor |
| `encode_packet()` / `decode_packet()` | `RingSoundProtocol.encodePacket()` / `decodePacket()` |
| `crc16_compute()` | `RingSoundProtocol.crc16()` |
| `PacketStream.feed()` | `PacketStream.feed()` |
| `BinaryReader` / `BinaryWriter` | 同名类型 |
| `get_system_info()` / `parse_system_info()` | `ring.getSystemInfo()` / `RingSoundParsers.systemInfo()` |
| `get_log_storage()` / `read_log_chunk()` | `ring.getLogStorage()` / `ring.readLogChunk()` |
| `enable_time_sync()` / `send_time_response()` | `ring.enableTimeSync()` / `ring.sendTimeResponse()` |
| `get_audio_file_count()` | `ring.getAudioFileCount()` |
| `get_audio_file_info()` | `ring.getAudioFileInfo()` |
| `read_audio_frame()` | `ring.readAudioFrame()` |
| `end_audio_extract()` | `ring.endAudioExtract()` |
| `receive_auto_audio_file()` | `ring.receiveAutoAudioFile()` |
| `download_audio_file()` | `ring.downloadAudioFile()` |
| `clear_audio_files()` | `ring.clearAudioFiles()` |
| `start_sensor_report()` / `stop_sensor_report()` | `ring.startSensorReport()` / `ring.stopSensorReport()` |
| `wait_sensor_data()` | `ring.waitForSensorData()` |
| 四种 `wait_sensor_*_event()` | 四种 `ring.waitFor*Event()` |
| `sensor_gesture_name()` | `RingSoundParsers.gestureName()` |
| `normalize_pcm_config()` / `format_pcm_config()` | `PCMConfig(...)` / `PCMConfig.description` |
| `parse_packetized_speex_stream()` | `AudioCodec.parsePacketizedSpeex()` |
| `split_raw_speex_packets()` | `AudioCodec.splitRawSpeexPackets()` |
| `build_ogg_speex()` | `AudioCodec.buildOggSpeex()` |
| `build_wav_from_pcm()` | `AudioCodec.buildWAV()` |
| `decode_speex_to_pcm()` | `AudioCodec.decodeSpeexToPCM()` |
| `decode_audio_to_wav()` | `AudioCodec.decodeAudioToWAV()` |
| `save_audio_bundle()` | `AudioCodec.saveAudioBundle()` |
| `ProgressPrinter` | `AudioProgressHandler` 闭包 |

Python 命令行入口没有移植为 Swift 可执行程序；Swift 交付物是供 iOS/macOS App 直接引用的 library package。

## 10. 验证

在包含 `Package.swift` 的目录运行：

```bash
swift test
swift build -c release
```

测试包括：

- SDK 版本、25 秒扫描默认值与固定 20 字节 NUS 写入
- Python 版生成的 CRC16 与完整协议包字节向量
- BLE 分片重组和多包输入
- 系统信息、录音帧、IMU 和动作事件解析
- Python 版生成的 WAV/Ogg Speex 字节级结果
- 请求/响应匹配、主动事件、超时与断线
- CoreBluetooth transport 的编译和协议一致性
