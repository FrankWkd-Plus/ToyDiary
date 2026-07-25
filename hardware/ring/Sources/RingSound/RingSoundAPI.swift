import Foundation

public func scanRings(
  identifier: UUID? = nil,
  timeout: TimeInterval = RingSoundDefaults.scanTimeout
) async throws -> [BLEDeviceInfo] {
  try await NusClient.discover(identifier: identifier, timeout: timeout)
}

public func connectRing(
  identifier: UUID? = nil,
  commandTimeout: TimeInterval = RingSoundDefaults.commandTimeout,
  autoTimeSync: Bool = false
) async throws -> RingSoundClient {
  let client = RingSoundClient(
    identifier: identifier,
    commandTimeout: commandTimeout
  )
  try await client.connect()
  if autoTimeSync {
    _ = await client.enableTimeSync()
  }
  return client
}

extension RingSoundClient {
  public func getSystemInfo(timeout: TimeInterval? = nil) async throws -> SystemInfo {
    let packet = try await request(
      command: SystemCommand.getInfo,
      responseCommand: SystemCommand.infoResponse,
      timeout: timeout
    )
    return try RingSoundParsers.systemInfo(packet.body)
  }

  public func sendTimeResponse(
    requestTime: UInt32,
    responseTime: UInt32? = nil,
    sendTime: UInt32? = nil
  ) async throws {
    let now = UInt32(Date().timeIntervalSince1970)
    var body = BinaryWriter()
    body.writeUInt32(requestTime)
    body.writeUInt32(responseTime ?? now)
    body.writeUInt32(sendTime ?? now)
    try await sendCommand(TimeCommand.response, body: body.data)
  }

  @discardableResult
  public func enableTimeSync() -> PacketHandlerToken {
    addPacketHandler(command: TimeCommand.request) { [weak self] packet in
      guard let self else { return }
      var reader = BinaryReader(packet.body)
      guard let requestTime = try? reader.readUInt32() else { return }
      try? await self.sendTimeResponse(requestTime: requestTime)
    }
  }

  public func getLogStorage(
    timeout: TimeInterval? = nil
  ) async throws -> LogStorageInfo {
    let packet = try await request(
      command: LogCommand.getStorage,
      responseCommand: LogCommand.storageResponse,
      timeout: timeout
    )
    return try RingSoundParsers.logStorageInfo(packet.body)
  }

  public func readLogChunk(
    index: UInt32,
    offset: UInt32,
    size: UInt32,
    timeout: TimeInterval? = nil
  ) async throws -> Data {
    var body = BinaryWriter()
    body.writeUInt32(index)
    body.writeUInt32(offset)
    body.writeUInt32(size)
    let packet = try await request(
      command: LogCommand.getLog,
      responseCommand: LogCommand.logResponse,
      body: body.data,
      timeout: timeout
    )
    var reader = BinaryReader(packet.body)
    try ensureSuccess(try reader.readUInt16())
    let dataLength = Int(try reader.readUInt32())
    return try reader.read(min(dataLength, reader.remaining))
  }

  public func getAudioFileCount(
    timeout: TimeInterval? = nil
  ) async throws -> UInt32 {
    let packet = try await request(
      command: AudioCommand.getList,
      responseCommand: AudioCommand.listResponse,
      timeout: timeout
    )
    return try RingSoundParsers.audioFileCount(packet.body)
  }

  public func getAudioFileInfo(
    fileIndex: UInt32,
    timeout: TimeInterval? = nil
  ) async throws -> AudioFileInfo {
    var body = BinaryWriter()
    body.writeUInt16(0)
    body.writeUInt32(fileIndex)
    let packet = try await request(
      command: AudioCommand.startExtract,
      responseCommand: AudioCommand.fileInfoResponse,
      body: body.data,
      timeout: timeout
    )
    return try RingSoundParsers.audioFileInfo(packet.body)
  }

  public func readAudioFrame(
    fileIndex: UInt32,
    frameOffset: UInt32,
    timeout: TimeInterval? = nil
  ) async throws -> AudioDataFrame {
    let packet = try await request(
      command: AudioCommand.nextFrame,
      responseCommand: AudioCommand.dataFrame,
      body: Self.audioFrameRequestBody(
        fileIndex: fileIndex,
        frameOffset: frameOffset
      ),
      timeout: timeout
    )
    return try RingSoundParsers.audioDataFrame(packet.body)
  }

  public func endAudioExtract(
    fileIndex: UInt32,
    timeout: TimeInterval? = nil,
    ignoreTimeout: Bool = true
  ) async throws {
    var body = BinaryWriter()
    body.writeUInt16(0)
    body.writeUInt32(fileIndex)
    do {
      let packet = try await request(
        command: AudioCommand.endExtract,
        responseCommand: AudioCommand.extractDone,
        body: body.data,
        timeout: timeout
      )
      var reader = BinaryReader(packet.body)
      try ensureSuccess(try reader.readUInt16())
    } catch RingSoundError.timeout where ignoreTimeout {
      return
    }
  }

  public func receiveAutoAudioFile(
    timeout: TimeInterval? = nil
  ) async throws -> AutoReceivedAudioFile {
    guard isConnected else {
      throw RingSoundError.transport("BLE client is not connected")
    }
    let firstPacket = try await waitForCommand(
      AudioCommand.dataFrame,
      timeout: timeout
    )
    var frame = try RingSoundParsers.audioDataFrame(firstPacket.body)
    var assembler = AutoAudioAssembler(fileIndex: frame.fileIndex)
    var recoveryAttempts = 0

    while true {
      var grew = try assembler.add(frame)
      if try assembler.appendPending() {
        grew = true
      }
      if grew {
        recoveryAttempts = 0
      }
      if let complete = assembler.completeData {
        return AutoReceivedAudioFile(
          fileIndex: assembler.fileIndex,
          data: complete
        )
      }

      if assembler.hasGap {
        recoveryAttempts += 1
        guard recoveryAttempts <= 3 else {
          throw RingSoundError.protocolError(
            "Audio frame gap: unable to recover offset \(assembler.received.count)"
          )
        }
        if assembler.expectedSize == nil {
          let info = try await getAudioFileInfo(
            fileIndex: assembler.fileIndex,
            timeout: timeout
          )
          try assembler.apply(info)
        }
        if let complete = assembler.completeData {
          return AutoReceivedAudioFile(
            fileIndex: assembler.fileIndex,
            data: complete
          )
        }
        try await requestAudioRetry(
          fileIndex: assembler.fileIndex,
          frameOffset: UInt32(assembler.received.count)
        )
      }

      while true {
        do {
          frame = try await waitAudioDataFrame(
            fileIndex: assembler.fileIndex,
            timeout: timeout
          )
          break
        } catch let error as RingSoundError {
          switch error {
          case .timeout, .protocolError:
            recoveryAttempts += 1
            guard recoveryAttempts <= 3 else {
              throw RingSoundError.protocolError(
                "Audio stream stalled: unable to recover offset \(assembler.received.count)"
              )
            }
            if assembler.expectedSize == nil {
              let info = try await getAudioFileInfo(
                fileIndex: assembler.fileIndex,
                timeout: timeout
              )
              try assembler.apply(info)
            }
            if let complete = assembler.completeData {
              return AutoReceivedAudioFile(
                fileIndex: assembler.fileIndex,
                data: complete
              )
            }
            try await requestAudioRetry(
              fileIndex: assembler.fileIndex,
              frameOffset: UInt32(assembler.received.count)
            )
          default:
            throw error
          }
        }
      }
    }
  }

  public func clearAudioFiles(timeout: TimeInterval? = nil) async throws {
    let packet = try await request(
      command: AudioCommand.clearAll,
      responseCommand: AudioCommand.clearAllResponse,
      timeout: timeout
    )
    var reader = BinaryReader(packet.body)
    try ensureSuccess(try reader.readUInt16())
  }

  public func downloadAudioFile(
    fileIndex: UInt32,
    progress: AudioProgressHandler? = nil,
    timeout: TimeInterval? = nil,
    quick: Bool = true
  ) async throws -> DownloadedAudioFile {
    if quick {
      return try await downloadAudioFileQuick(
        fileIndex: fileIndex,
        progress: progress,
        timeout: timeout
      )
    }

    let info = try await getAudioFileInfo(
      fileIndex: fileIndex,
      timeout: timeout
    )
    guard info.fileIndex == fileIndex else {
      throw RingSoundError.protocolError(
        "Audio metadata index mismatch: expected \(fileIndex), got \(info.fileIndex)"
      )
    }
    var received = Data()

    while true {
      let frame = try await readAudioFrame(
        fileIndex: fileIndex,
        frameOffset: UInt32(received.count),
        timeout: timeout
      )
      let newData = try Self.merge(
        frame: frame,
        into: &received,
        expectedSize: Int(info.dataSize)
      )
      progress?(received.count, Int(info.dataSize))
      if info.dataSize > 0, received.count >= Int(info.dataSize) {
        break
      }
      if frame.isEnd {
        throw RingSoundError.protocolError(
          "Audio stream ended at \(received.count) of \(info.dataSize) bytes"
        )
      }
      if newData == 0 {
        throw RingSoundError.protocolError(
          "Audio transfer made no progress at offset \(received.count)"
        )
      }
    }

    try await endAudioExtract(
      fileIndex: fileIndex,
      timeout: timeout,
      ignoreTimeout: false
    )
    return DownloadedAudioFile(
      info: info,
      data: Data(received.prefix(Int(info.dataSize)))
    )
  }

  public func startSensorReport(
    timeout: TimeInterval? = nil
  ) async throws -> SensorStartInfo {
    let packet = try await request(
      command: SensorCommand.startReport,
      responseCommand: SensorCommand.startReportResponse,
      timeout: timeout
    )
    return try RingSoundParsers.sensorStartInfo(packet.body)
  }

  public func stopSensorReport(
    timeout: TimeInterval? = nil
  ) async throws -> SensorStopInfo {
    let packet = try await request(
      command: SensorCommand.stopReport,
      responseCommand: SensorCommand.stopReportResponse,
      timeout: timeout
    )
    return try RingSoundParsers.sensorStopInfo(packet.body)
  }

  public func waitForSensorData(
    timeout: TimeInterval? = nil
  ) async throws -> SensorDataBatch {
    let packet = try await waitForCommand(
      SensorCommand.dataFrame,
      timeout: timeout
    )
    return try RingSoundParsers.sensorDataBatch(packet.body)
  }

  public func waitForDoubleTapEvent(
    timeout: TimeInterval? = nil
  ) async throws -> SensorDoubleTapEvent {
    let packet = try await waitForCommand(
      SensorCommand.doubleTap,
      timeout: timeout
    )
    return try RingSoundParsers.doubleTapEvent(packet.body)
  }

  public func waitForGestureEvent(
    timeout: TimeInterval? = nil
  ) async throws -> SensorGestureEvent {
    let packet = try await waitForCommand(
      SensorCommand.gesture,
      timeout: timeout
    )
    return try RingSoundParsers.gestureEvent(packet.body)
  }

  public func waitForKeyDoublePressEvent(
    timeout: TimeInterval? = nil
  ) async throws -> SensorKeyDoublePressEvent {
    let packet = try await waitForCommand(
      SensorCommand.keyDoublePress,
      timeout: timeout
    )
    return try RingSoundParsers.keyDoublePressEvent(packet.body)
  }

  public func waitForKeySinglePressEvent(
    timeout: TimeInterval? = nil
  ) async throws -> SensorKeySinglePressEvent {
    let packet = try await waitForCommand(
      SensorCommand.keySinglePress,
      timeout: timeout
    )
    return try RingSoundParsers.keySinglePressEvent(packet.body)
  }

  private func downloadAudioFileQuick(
    fileIndex: UInt32,
    progress: AudioProgressHandler?,
    timeout: TimeInterval?
  ) async throws -> DownloadedAudioFile {
    drainCommandQueue(AudioCommand.fileInfoResponse.rawValue)
    drainCommandQueue(AudioCommand.dataFrame.rawValue)
    var requestBody = BinaryWriter()
    requestBody.writeUInt16(0)
    requestBody.writeUInt32(fileIndex)
    try await sendCommand(
      AudioCommand.startExtractQuick,
      body: requestBody.data
    )

    let infoPacket = try await waitForCommand(
      AudioCommand.fileInfoResponse,
      timeout: timeout
    )
    let info = try RingSoundParsers.audioFileInfo(infoPacket.body)
    guard info.fileIndex == fileIndex else {
      throw RingSoundError.protocolError(
        "Audio metadata index mismatch: expected \(fileIndex), got \(info.fileIndex)"
      )
    }

    var received = Data()
    var gapRetries = 0
    while true {
      let frame: AudioDataFrame
      do {
        frame = try await waitAudioDataFrame(
          fileIndex: fileIndex,
          timeout: timeout
        )
      } catch RingSoundError.timeout {
        gapRetries += 1
        guard gapRetries <= 3 else {
          throw RingSoundError.protocolError(
            "Audio stream stalled at offset \(received.count)"
          )
        }
        try await requestAudioRetry(
          fileIndex: fileIndex,
          frameOffset: UInt32(received.count)
        )
        frame = try await waitAudioDataFrame(
          fileIndex: fileIndex,
          timeout: timeout
        )
      }

      if Int(frame.frameOffset) > received.count {
        gapRetries += 1
        guard gapRetries <= 3 else {
          throw RingSoundError.protocolError(
            "Audio frame gap: expected offset \(received.count), got \(frame.frameOffset)"
          )
        }
        try await requestAudioRetry(
          fileIndex: fileIndex,
          frameOffset: UInt32(received.count)
        )
        continue
      }

      let added = try Self.merge(
        frame: frame,
        into: &received,
        expectedSize: Int(info.dataSize)
      )
      if added > 0 {
        gapRetries = 0
      }
      progress?(received.count, Int(info.dataSize))
      if info.dataSize > 0, received.count >= Int(info.dataSize) {
        break
      }
      if frame.isEnd {
        gapRetries += 1
        guard gapRetries <= 3 else {
          throw RingSoundError.protocolError(
            "Audio stream ended at \(received.count) of \(info.dataSize) bytes"
          )
        }
        try await requestAudioRetry(
          fileIndex: fileIndex,
          frameOffset: UInt32(received.count)
        )
      } else if frame.data.isEmpty {
        throw RingSoundError.protocolError(
          "Empty audio frame at offset \(frame.frameOffset) before end"
        )
      }
    }

    return DownloadedAudioFile(
      info: info,
      data: Data(received.prefix(Int(info.dataSize)))
    )
  }

  private func waitAudioDataFrame(
    fileIndex: UInt32,
    timeout: TimeInterval?
  ) async throws -> AudioDataFrame {
    let interval = max(0.001, timeout ?? commandTimeout)
    let deadline = Date().addingTimeInterval(interval)
    while true {
      let remaining = deadline.timeIntervalSinceNow
      guard remaining > 0 else {
        throw RingSoundError.timeout(
          command: AudioCommand.dataFrame.rawValue
        )
      }
      let packet = try await waitForCommand(
        AudioCommand.dataFrame,
        timeout: remaining
      )
      let frame = try RingSoundParsers.audioDataFrame(packet.body)
      if frame.fileIndex == fileIndex {
        return frame
      }
    }
  }

  private func requestAudioRetry(
    fileIndex: UInt32,
    frameOffset: UInt32
  ) async throws {
    try await sendCommand(
      AudioCommand.nextFrame,
      body: Self.audioFrameRequestBody(
        fileIndex: fileIndex,
        frameOffset: frameOffset
      )
    )
  }

  private static func audioFrameRequestBody(
    fileIndex: UInt32,
    frameOffset: UInt32
  ) -> Data {
    var body = BinaryWriter()
    body.writeUInt16(0)
    body.writeUInt32(fileIndex)
    body.writeUInt32(frameOffset)
    // Current firmware validates a 12-byte struct but parses only 10 bytes.
    body.writeUInt16(0)
    return body.data
  }

  @discardableResult
  private static func merge(
    frame: AudioDataFrame,
    into received: inout Data,
    expectedSize: Int
  ) throws -> Int {
    let offset = Int(frame.frameOffset)
    guard offset <= received.count else {
      throw RingSoundError.protocolError(
        "Audio frame gap: expected offset \(received.count), got \(frame.frameOffset)"
      )
    }
    let overlap = received.count - offset
    let overlapSize = min(overlap, frame.data.count)
    if overlapSize > 0 {
      let existing = Data(received[offset..<(offset + overlapSize)])
      guard existing == frame.data.prefix(overlapSize) else {
        throw RingSoundError.protocolError(
          "Conflicting audio overlap at offset \(frame.frameOffset)"
        )
      }
    }
    guard overlap < frame.data.count else { return 0 }

    var newData = Data(frame.data.dropFirst(overlap))
    if expectedSize > 0 {
      newData = Data(
        newData.prefix(max(0, expectedSize - received.count))
      )
    }
    received.append(newData)
    return newData.count
  }
}

private struct AutoAudioAssembler {
  let fileIndex: UInt32
  var received = Data()
  var pending: [UInt32: AudioDataFrame] = [:]
  var endOffset: Int?
  var expectedSize: Int?

  var hasGap: Bool {
    guard let first = pending.keys.min() else { return false }
    return Int(first) > received.count
  }

  var completeData: Data? {
    guard let endOffset, received.count >= endOffset else { return nil }
    return Data(received.prefix(endOffset))
  }

  mutating func apply(_ info: AudioFileInfo) throws {
    guard info.fileIndex == fileIndex else {
      throw RingSoundError.protocolError(
        "Audio metadata index mismatch: expected \(fileIndex), got \(info.fileIndex)"
      )
    }
    guard info.dataSize > 0 else {
      throw RingSoundError.protocolError(
        "Audio metadata has invalid data_size=\(info.dataSize)"
      )
    }
    expectedSize = Int(info.dataSize)
    endOffset = Int(info.dataSize)
    if received.count > Int(info.dataSize) {
      received = Data(received.prefix(Int(info.dataSize)))
    }
    pending = pending.filter { Int($0.key) < Int(info.dataSize) }
  }

  @discardableResult
  mutating func add(_ frame: AudioDataFrame) throws -> Bool {
    guard frame.fileIndex == fileIndex else {
      throw RingSoundError.protocolError(
        "Audio file index mismatch: expected \(fileIndex), got \(frame.fileIndex)"
      )
    }
    let offset = Int(frame.frameOffset)
    if let expectedSize, offset > expectedSize {
      throw RingSoundError.protocolError(
        "Audio frame offset \(offset) exceeds file size \(expectedSize)"
      )
    }

    var frameData = frame.data
    if let expectedSize {
      frameData = Data(
        frameData.prefix(max(0, expectedSize - offset))
      )
    }
    let frameEnd = offset + frameData.count
    if frame.isEnd, expectedSize == nil {
      if let endOffset, endOffset != frameEnd {
        throw RingSoundError.protocolError(
          "Conflicting audio end offsets: \(endOffset) and \(frameEnd)"
        )
      }
      endOffset = frameEnd
    }

    let previousSize = received.count
    if frameEnd <= previousSize {
      let existing = Data(received[offset..<frameEnd])
      guard existing == frameData else {
        throw RingSoundError.protocolError(
          "Conflicting audio data at offset \(offset)"
        )
      }
      return false
    }
    if offset <= previousSize {
      let overlap = previousSize - offset
      let existing = Data(received[offset..<previousSize])
      guard existing == frameData.prefix(overlap) else {
        throw RingSoundError.protocolError(
          "Conflicting audio overlap at offset \(offset)"
        )
      }
      received.append(frameData.dropFirst(overlap))
      return received.count > previousSize
    }

    if pending[frame.frameOffset].map({ $0.data.count }) ?? -1
      < frame.data.count
    {
      pending[frame.frameOffset] = frame
    }
    return false
  }

  @discardableResult
  mutating func appendPending() throws -> Bool {
    var grew = false
    while let offset = pending.keys.min(), Int(offset) <= received.count {
      guard let frame = pending.removeValue(forKey: offset) else {
        break
      }
      if try add(frame) {
        grew = true
      }
    }
    return grew
  }
}
