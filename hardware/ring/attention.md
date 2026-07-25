Apple 不公开 BLE MAC 地址，Swift 版使用 CBPeripheral.identifier UUID。
iOS 需配置 NSBluetoothAlwaysUsageDescription；macOS 沙盒应用需启用 Bluetooth entitlement。
macOS 可用 ffmpeg 解码 Speex；iOS 需注入原生 SpeexDecoder。
Swift v2.0.0 对齐 Python 0.4.1，默认扫描 25 秒；NUS 写入固定按 20 字节分片。
旧版调用中若传入 writeChunkSize 或 write_chunk_size，升级后需要移除。
