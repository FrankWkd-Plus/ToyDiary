import Foundation

public enum RingSoundParsers {
  public static func systemInfo(_ body: Data) throws -> SystemInfo {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    return SystemInfo(
      firmwareVersion: try reader.readStringUInt16(),
      systemTime: try reader.readUInt32(),
      audioStorageTotal: try reader.readUInt32(),
      audioStorageAvailable: try reader.readUInt32(),
      batteryPercent: try reader.readUInt16(),
      batteryCharging: try reader.readUInt8() != 0,
      serialNumber: try reader.readStringUInt16(),
      cpuID: try reader.readStringUInt16(),
      model: try reader.readStringUInt16()
    )
  }

  public static func logStorageInfo(_ body: Data) throws -> LogStorageInfo {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    return LogStorageInfo(
      pageSize: try reader.readUInt32(),
      totalLength: try reader.readUInt32()
    )
  }

  public static func audioFileCount(_ body: Data) throws -> UInt32 {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    return try reader.readUInt32()
  }

  public static func audioFileInfo(_ body: Data) throws -> AudioFileInfo {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    let info = AudioFileInfo(
      fileIndex: try reader.readUInt32(),
      recordTime: try reader.readUInt32(),
      dataSize: try reader.readUInt32()
    )
    guard reader.remaining == 0 else {
      throw RingSoundError.protocolError(
        "Unexpected trailing audio file info bytes: \(reader.remaining)"
      )
    }
    return info
  }

  public static func audioDataFrame(_ body: Data) throws -> AudioDataFrame {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    let fileIndex = try reader.readUInt32()
    let frameOffset = try reader.readUInt32()
    let frameSize = try reader.readUInt32()
    let isEnd = try reader.readUInt8() != 0
    guard reader.remaining == Int(frameSize) else {
      throw RingSoundError.protocolError(
        "Audio frame size mismatch: declared \(frameSize), got \(reader.remaining)"
      )
    }
    return AudioDataFrame(
      fileIndex: fileIndex,
      frameOffset: frameOffset,
      frameSize: frameSize,
      isEnd: isEnd,
      data: try reader.read(Int(frameSize))
    )
  }

  public static func sensorStartInfo(_ body: Data) throws -> SensorStartInfo {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    return SensorStartInfo(
      sampleRateHz: try reader.readUInt16(),
      accelerationRangeG: try reader.readUInt16(),
      gyroscopeRangeDPS: try reader.readUInt16()
    )
  }

  public static func sensorStopInfo(_ body: Data) throws -> SensorStopInfo {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    return SensorStopInfo()
  }

  public static func sensorDataBatch(_ body: Data) throws -> SensorDataBatch {
    var reader = BinaryReader(body)
    try ensureSuccess(try reader.readUInt16())
    let sequenceStart = try reader.readUInt32()
    let frameCount = try reader.readUInt16()
    let sampleSize = try reader.readUInt16()
    guard sampleSize == 16 else {
      throw RingSoundError.protocolError(
        "Unsupported sensor sample size: \(sampleSize)"
      )
    }
    let expectedRemaining = Int(frameCount) * Int(sampleSize)
    guard reader.remaining == expectedRemaining else {
      throw RingSoundError.protocolError(
        "Sensor batch length mismatch: expected \(expectedRemaining) sample bytes, got \(reader.remaining)"
      )
    }

    var samples: [SensorDataSample] = []
    samples.reserveCapacity(Int(frameCount))
    for _ in 0..<frameCount {
      samples.append(
        SensorDataSample(
          timestampMilliseconds: try reader.readUInt32(),
          accelerationX: try reader.readInt16(),
          accelerationY: try reader.readInt16(),
          accelerationZ: try reader.readInt16(),
          gyroscopeX: try reader.readInt16(),
          gyroscopeY: try reader.readInt16(),
          gyroscopeZ: try reader.readInt16()
        )
      )
    }
    return SensorDataBatch(
      sequenceStart: sequenceStart,
      frameCount: frameCount,
      sampleSize: sampleSize,
      samples: samples
    )
  }

  public static func doubleTapEvent(_ body: Data) throws -> SensorDoubleTapEvent {
    var reader = BinaryReader(body)
    let event = SensorDoubleTapEvent(
      timestampMilliseconds: try reader.readUInt32()
    )
    try rejectTrailing(reader.remaining, label: "double-tap")
    return event
  }

  public static func gestureEvent(_ body: Data) throws -> SensorGestureEvent {
    var reader = BinaryReader(body)
    let event = SensorGestureEvent(
      timestampMilliseconds: try reader.readUInt32(),
      gestureID: try reader.readUInt8()
    )
    try rejectTrailing(reader.remaining, label: "gesture")
    return event
  }

  public static func keyDoublePressEvent(
    _ body: Data
  ) throws -> SensorKeyDoublePressEvent {
    var reader = BinaryReader(body)
    let event = SensorKeyDoublePressEvent(
      timestampMilliseconds: try reader.readUInt32()
    )
    try rejectTrailing(reader.remaining, label: "key double-press")
    return event
  }

  public static func keySinglePressEvent(
    _ body: Data
  ) throws -> SensorKeySinglePressEvent {
    var reader = BinaryReader(body)
    let event = SensorKeySinglePressEvent(
      timestampMilliseconds: try reader.readUInt32()
    )
    try rejectTrailing(reader.remaining, label: "key single-press")
    return event
  }

  public static func gestureName(_ gestureID: UInt8) -> String {
    switch SensorGestureID(rawValue: gestureID) {
    case .idle: "idle"
    case .rotateBack: "rotate_back"
    case .rotateFront: "rotate_front"
    case .wave: "wave"
    case nil: "unknown(\(gestureID))"
    }
  }

  private static func rejectTrailing(_ remaining: Int, label: String) throws {
    guard remaining == 0 else {
      throw RingSoundError.protocolError(
        "Unexpected trailing \(label) event bytes: \(remaining)"
      )
    }
  }
}
