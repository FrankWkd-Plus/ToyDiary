import Foundation

public enum AudioCodec {
  private static let bitsByQuality: [Int: Int] = [
    1: 10,
    2: 15,
    3: 20,
    4: 20,
    5: 28,
    6: 28,
    7: 38,
    8: 38,
    9: 46,
    10: 46,
  ]

  public static func buildWAV(
    pcm: Data,
    config: PCMConfig = PCMConfig()
  ) -> Data {
    let blockAlign = config.channels * config.bitDepth / 8
    let byteRate = config.sampleRate * blockAlign
    var result = Data()
    result.appendASCII("RIFF")
    result.appendLittleEndian(UInt32(36 + pcm.count))
    result.appendASCII("WAVE")
    result.appendASCII("fmt ")
    result.appendLittleEndian(UInt32(16))
    result.appendLittleEndian(UInt16(1))
    result.appendLittleEndian(UInt16(config.channels))
    result.appendLittleEndian(UInt32(config.sampleRate))
    result.appendLittleEndian(UInt32(byteRate))
    result.appendLittleEndian(UInt16(blockAlign))
    result.appendLittleEndian(UInt16(config.bitDepth))
    result.appendASCII("data")
    result.appendLittleEndian(UInt32(pcm.count))
    result.append(pcm)
    return result
  }

  public static func isWAV(_ data: Data) -> Bool {
    guard data.count >= 12 else { return false }
    return data.prefix(4) == Data("RIFF".utf8)
      && data.dropFirst(8).prefix(4) == Data("WAVE".utf8)
  }

  public static func isOggSpeex(_ data: Data) -> Bool {
    guard data.count >= 36, data.prefix(4) == Data("OggS".utf8) else {
      return false
    }
    let marker = Data("Speex   ".utf8)
    return data.dropFirst(28).prefix(8) == marker
      || data.prefix(128).range(of: marker) != nil
  }

  public static func speexMode(sampleRate: Int) -> Int {
    if sampleRate <= 8_000 { return 0 }
    if sampleRate <= 16_000 { return 1 }
    return 2
  }

  public static func frameSize(sampleRate: Int) -> Int {
    if sampleRate <= 8_000 { return 160 }
    if sampleRate <= 16_000 { return 320 }
    return 640
  }

  public static func bitsSize(
    quality: Int = RingSoundDefaults.speexQuality,
    explicitBitsSize: Int? = nil
  ) -> Int {
    if let explicitBitsSize, explicitBitsSize > 0 {
      return explicitBitsSize
    }
    return bitsByQuality[quality] ?? 20
  }

  public static func parsePacketizedSpeex(
    _ data: Data,
    maxPacketSize: Int = RingSoundDefaults.speexMaximumPacketSize,
    allowFramedBlocks: Bool = true,
    framedBlockSize: Int = RingSoundDefaults.legacyOuterFrameSize
  ) -> [Data]? {
    let source = Array(data)
    let maximum = max(1, maxPacketSize)

    func parseBlock(start: Int, end: Int) -> [Data]? {
      var packets: [Data] = []
      var offset = start
      while offset + 2 <= end {
        let length = Int(source[offset]) | (Int(source[offset + 1]) << 8)
        if length == 0 { break }
        guard length <= maximum, offset + 2 + length <= end else {
          return nil
        }
        packets.append(Data(source[(offset + 2)..<(offset + 2 + length)]))
        offset += 2 + length
      }
      guard !packets.isEmpty else { return nil }
      guard source[offset..<end].allSatisfy({ $0 == 0 || $0 == 0xff }) else {
        return nil
      }
      return packets
    }

    if let direct = parseBlock(start: 0, end: source.count) {
      return direct
    }
    guard allowFramedBlocks else { return nil }

    let blockSize = max(1, framedBlockSize)
    guard source.count > blockSize else { return nil }
    var packets: [Data] = []
    for start in stride(from: 0, to: source.count, by: blockSize) {
      guard
        let block = parseBlock(
          start: start,
          end: min(source.count, start + blockSize)
        )
      else {
        return nil
      }
      packets.append(contentsOf: block)
    }
    return packets
  }

  public static func splitRawSpeexPackets(
    _ data: Data,
    quality: Int = RingSoundDefaults.speexQuality,
    bitsSize explicitBitsSize: Int? = nil
  ) -> [Data]? {
    let size = bitsSize(quality: quality, explicitBitsSize: explicitBitsSize)
    guard data.count >= size, data.count.isMultiple(of: size) else {
      return nil
    }
    return stride(from: 0, to: data.count, by: size).map {
      Data(data[$0..<($0 + size)])
    }
  }

  public static func buildOggSpeex(
    packets: [Data],
    config: PCMConfig = PCMConfig(),
    serial: UInt32 = 0x564f_5247
  ) throws -> Data {
    let selectedFrameSize = frameSize(sampleRate: config.sampleRate)
    let mode = speexMode(sampleRate: config.sampleRate)

    var speexHeader = Data("Speex   ".utf8)
    var version = Data("speex-1.2.1".utf8)
    version.append(Data(repeating: 0, count: 20 - version.count))
    speexHeader.append(version)
    for value: Int32 in [
      1,
      80,
      Int32(config.sampleRate),
      Int32(mode),
      4,
      1,
      -1,
      Int32(selectedFrameSize),
      0,
      1,
      0,
      0,
      0,
    ] {
      speexHeader.appendLittleEndian(value)
    }

    let vendor = Data("ring-sound-python".utf8)
    var comments = Data()
    comments.appendLittleEndian(UInt32(vendor.count))
    comments.append(vendor)
    comments.appendLittleEndian(UInt32(0))

    var result = Data()
    result.append(
      try buildOggPage(
        packet: speexHeader,
        headerType: 2,
        granulePosition: 0,
        serial: serial,
        sequence: 0
      )
    )
    result.append(
      try buildOggPage(
        packet: comments,
        headerType: 0,
        granulePosition: 0,
        serial: serial,
        sequence: 1
      )
    )

    var granule: UInt64 = 0
    for (index, packet) in packets.enumerated() {
      granule += UInt64(selectedFrameSize)
      result.append(
        try buildOggPage(
          packet: packet,
          headerType: index == packets.count - 1 ? 4 : 0,
          granulePosition: granule,
          serial: serial,
          sequence: UInt32(index + 2)
        )
      )
    }
    return result
  }

  public static func normalizeDecodedPCM(
    _ pcmData: Data,
    packetCount: Int,
    config: PCMConfig = PCMConfig()
  ) -> Data {
    let count = max(0, packetCount)
    guard !pcmData.isEmpty, count > 0 else { return pcmData }

    let bytesPerSample = max(1, config.bitDepth / 8)
    let frameBytes =
      frameSize(sampleRate: config.sampleRate)
      * config.channels
      * bytesPerSample
    let expectedBytes = frameBytes * count
    guard frameBytes > 0, pcmData.count > expectedBytes else {
      return pcmData
    }

    let decodedBytesPerPacket = pcmData.count / count
    guard pcmData.count.isMultiple(of: count),
      decodedBytesPerPacket.isMultiple(of: frameBytes)
    else {
      return pcmData
    }

    var result = Data()
    result.reserveCapacity(expectedBytes)
    for offset in stride(
      from: 0,
      to: pcmData.count,
      by: decodedBytesPerPacket
    ) {
      result.append(pcmData[offset..<(offset + frameBytes)])
    }
    return result
  }

  public static func decodeSpeexToPCM(
    _ data: Data,
    config: PCMConfig = PCMConfig(),
    quality: Int = RingSoundDefaults.speexQuality,
    bitsSize: Int? = nil,
    allowFramedBlocks: Bool = false,
    ffmpegPath: String = "ffmpeg",
    decoder: SpeexDecoder? = nil
  ) throws -> SpeexDecodeResult {
    guard !data.isEmpty else {
      throw RingSoundError.audioDecode("Speex data is empty")
    }
    let options = SpeexDecodeOptions(
      pcmConfig: config,
      quality: quality,
      bitsSize: bitsSize,
      allowFramedBlocks: allowFramedBlocks,
      ffmpegPath: ffmpegPath
    )
    if let decoder {
      return try decoder(data, options)
    }

    if isOggSpeex(data) {
      return SpeexDecodeResult(
        pcmData: try decodeOggSpeexWithFFmpeg(
          data,
          config: config,
          ffmpegPath: ffmpegPath
        ),
        pcmConfig: config,
        sourceType: "ogg-speex",
        sourceExtension: "spx"
      )
    }

    var packets = parsePacketizedSpeex(
      data,
      allowFramedBlocks: allowFramedBlocks
    )
    var sourceType = "packet-speex"
    if packets == nil {
      packets = splitRawSpeexPackets(
        data,
        quality: quality,
        bitsSize: bitsSize
      )
      sourceType = "raw-speex"
    }
    guard let packets else {
      throw RingSoundError.audioDecode(
        "bin data does not look like packetized or raw Speex"
      )
    }

    let ogg = try buildOggSpeex(packets: packets, config: config)
    let decoded = try decodeOggSpeexWithFFmpeg(
      ogg,
      config: config,
      ffmpegPath: ffmpegPath
    )
    return SpeexDecodeResult(
      pcmData: normalizeDecodedPCM(
        decoded,
        packetCount: packets.count,
        config: config
      ),
      pcmConfig: config,
      sourceType: sourceType,
      sourceExtension: "spx",
      packetCount: packets.count
    )
  }

  public static func buildPlayableAudio(
    data: Data,
    config: PCMConfig = PCMConfig(),
    quality: Int = RingSoundDefaults.speexQuality,
    bitsSize: Int? = nil,
    allowFramedBlocks: Bool = false,
    ffmpegPath: String = "ffmpeg",
    decoder: SpeexDecoder? = nil
  ) throws -> PlayableAudio {
    if isWAV(data) {
      return PlayableAudio(
        data: data,
        fileExtension: "wav",
        mimeType: "audio/wav",
        playMode: "direct",
        label: "WAV",
        sourceType: "wav",
        sourceExtension: "wav",
        sourceMIMEType: "audio/wav",
        description: "Detected WAV audio; saved directly."
      )
    }

    let decoded = try decodeSpeexToPCM(
      data,
      config: config,
      quality: quality,
      bitsSize: bitsSize,
      allowFramedBlocks: allowFramedBlocks,
      ffmpegPath: ffmpegPath,
      decoder: decoder
    )
    return PlayableAudio(
      data: buildWAV(pcm: decoded.pcmData, config: decoded.pcmConfig),
      fileExtension: "wav",
      mimeType: "audio/wav",
      playMode: "speex-decode",
      label: "WAV",
      pcmConfig: decoded.pcmConfig,
      sourceType: decoded.sourceType,
      sourceExtension: decoded.sourceExtension,
      sourceMIMEType: "audio/x-speex",
      description: "Decoded Speex and wrapped as WAV. \(decoded.pcmConfig)"
    )
  }

  public static func decodeAudioToWAV(
    _ data: Data,
    config: PCMConfig = PCMConfig(),
    quality: Int = RingSoundDefaults.speexQuality,
    bitsSize: Int? = nil,
    allowFramedBlocks: Bool = false,
    ffmpegPath: String = "ffmpeg",
    decoder: SpeexDecoder? = nil
  ) throws -> Data {
    try buildPlayableAudio(
      data: data,
      config: config,
      quality: quality,
      bitsSize: bitsSize,
      allowFramedBlocks: allowFramedBlocks,
      ffmpegPath: ffmpegPath,
      decoder: decoder
    ).data
  }

  public static func buildBaseName(
    fileIndex: UInt32,
    recordTime: UInt32? = nil,
    now: Date = Date(),
    calendar: Calendar = .current
  ) -> String {
    let recordingDate =
      recordTime.flatMap { $0 == 0 ? nil : Date(timeIntervalSince1970: TimeInterval($0)) }
      ?? now
    let components = calendar.dateComponents(
      [.year, .month, .day, .hour, .minute, .second],
      from: recordingDate
    )
    let suffixMilliseconds = Int64(now.timeIntervalSince1970 * 1_000)
    return String(
      format: "ring-sound-%03u-%04d%02d%02d-%02d%02d%02d-%lld",
      fileIndex,
      components.year ?? 0,
      components.month ?? 0,
      components.day ?? 0,
      components.hour ?? 0,
      components.minute ?? 0,
      components.second ?? 0,
      suffixMilliseconds
    )
  }

  public static func buildBundleURLs(
    fileIndex: UInt32,
    recordTime: UInt32? = nil,
    outputURL: URL? = nil,
    outputDirectory: URL? = nil,
    now: Date = Date()
  ) -> (raw: URL, playable: URL) {
    if let outputURL {
      let base = outputURL.deletingPathExtension()
      return (
        base.appendingPathExtension("bin"),
        base.appendingPathExtension("wav")
      )
    }
    let directory = outputDirectory ?? URL(fileURLWithPath: ".")
    let name = buildBaseName(
      fileIndex: fileIndex,
      recordTime: recordTime,
      now: now
    )
    return (
      directory.appendingPathComponent(name).appendingPathExtension("bin"),
      directory.appendingPathComponent(name).appendingPathExtension("wav")
    )
  }

  public static func saveAudioBundle(
    fileIndex: UInt32,
    data: Data,
    recordTime: UInt32? = nil,
    outputURL: URL? = nil,
    outputDirectory: URL? = nil,
    config: PCMConfig = PCMConfig(),
    quality: Int = RingSoundDefaults.speexQuality,
    bitsSize: Int? = nil,
    allowFramedBlocks: Bool = false,
    ffmpegPath: String = "ffmpeg",
    decoder: SpeexDecoder? = nil
  ) throws -> AudioBundle {
    let urls = buildBundleURLs(
      fileIndex: fileIndex,
      recordTime: recordTime,
      outputURL: outputURL,
      outputDirectory: outputDirectory
    )
    let manager = FileManager.default
    try manager.createDirectory(
      at: urls.raw.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    try manager.createDirectory(
      at: urls.playable.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    try data.write(to: urls.raw, options: .atomic)
    let playable = try buildPlayableAudio(
      data: data,
      config: config,
      quality: quality,
      bitsSize: bitsSize,
      allowFramedBlocks: allowFramedBlocks,
      ffmpegPath: ffmpegPath,
      decoder: decoder
    )
    try playable.data.write(to: urls.playable, options: .atomic)
    return AudioBundle(
      rawURL: urls.raw,
      rawFileName: urls.raw.lastPathComponent,
      playableURL: urls.playable,
      playableFileName: urls.playable.lastPathComponent,
      playMode: playable.playMode,
      formatLabel: playable.label,
      playDescription: playable.description,
      pcmSummary: (playable.pcmConfig ?? config).description,
      rawSize: data.count,
      playableSize: playable.data.count,
      sourceType: playable.sourceType,
      sourceExtension: playable.sourceExtension
    )
  }

  public static func decodeOggSpeexWithFFmpeg(
    _ oggData: Data,
    config: PCMConfig = PCMConfig(),
    ffmpegPath: String = "ffmpeg"
  ) throws -> Data {
    #if os(macOS)
      let manager = FileManager.default
      let temporaryDirectory = manager.temporaryDirectory
        .appendingPathComponent("ring-sound-\(UUID().uuidString)", isDirectory: true)
      try manager.createDirectory(
        at: temporaryDirectory,
        withIntermediateDirectories: true
      )
      defer { try? manager.removeItem(at: temporaryDirectory) }

      let inputURL = temporaryDirectory.appendingPathComponent("input.ogg")
      let outputURL = temporaryDirectory.appendingPathComponent("output.pcm")
      try oggData.write(to: inputURL)

      let process = Process()
      if ffmpegPath.contains("/") {
        guard manager.isExecutableFile(atPath: ffmpegPath) else {
          throw RingSoundError.speexDecoderUnavailable(
            "ffmpeg is required to decode Speex. Install ffmpeg or pass its path."
          )
        }
        process.executableURL = URL(fileURLWithPath: ffmpegPath)
        process.arguments = ffmpegArguments(
          inputURL: inputURL,
          outputURL: outputURL,
          config: config
        )
      } else {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments =
          [ffmpegPath]
          + ffmpegArguments(
            inputURL: inputURL,
            outputURL: outputURL,
            config: config
          )
      }
      let errorPipe = Pipe()
      process.standardError = errorPipe

      do {
        try process.run()
      } catch {
        throw RingSoundError.speexDecoderUnavailable(
          "ffmpeg is required to decode Speex. Install ffmpeg or pass its path."
        )
      }
      process.waitUntilExit()
      guard process.terminationStatus == 0 else {
        let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
        let message = String(decoding: errorData, as: UTF8.self)
        throw RingSoundError.audioDecode(
          "ffmpeg Speex decode failed: \(message.prefix(500))"
        )
      }
      return try Data(contentsOf: outputURL)
    #else
      throw RingSoundError.speexDecoderUnavailable(
        "iOS does not run ffmpeg processes; pass a native SpeexDecoder implementation."
      )
    #endif
  }

  private static func buildOggPage(
    packet: Data,
    headerType: UInt8,
    granulePosition: UInt64,
    serial: UInt32,
    sequence: UInt32
  ) throws -> Data {
    var remaining = packet.count
    var lacing: [UInt8] = []
    while remaining >= 255 {
      lacing.append(255)
      remaining -= 255
    }
    lacing.append(UInt8(remaining))
    guard lacing.count <= 255 else {
      throw RingSoundError.audioDecode(
        "single Ogg page cannot contain this packet"
      )
    }

    var page = Data("OggS".utf8)
    page.append(0)
    page.append(headerType)
    page.appendLittleEndian(granulePosition)
    page.appendLittleEndian(serial)
    page.appendLittleEndian(sequence)
    page.appendLittleEndian(UInt32(0))
    page.append(UInt8(lacing.count))
    page.append(contentsOf: lacing)
    page.append(packet)

    let checksum = oggCRC(page)
    page.replaceSubrange(22..<26, with: checksum.littleEndianBytes)
    return page
  }

  private static func oggCRC(_ data: Data) -> UInt32 {
    var crc: UInt32 = 0
    for value in data {
      crc ^= UInt32(value) << 24
      for _ in 0..<8 {
        crc =
          crc & 0x8000_0000 != 0
          ? (crc << 1) ^ 0x04c1_1db7
          : crc << 1
      }
    }
    return crc
  }

  #if os(macOS)
    private static func ffmpegArguments(
      inputURL: URL,
      outputURL: URL,
      config: PCMConfig
    ) -> [String] {
      [
        "-hide_banner",
        "-loglevel", "error",
        "-f", "ogg",
        "-i", inputURL.path,
        "-f", config.bitDepth == 16 ? "s16le" : "u8",
        "-ac", String(config.channels),
        "-ar", String(config.sampleRate),
        "-y",
        outputURL.path,
      ]
    }
  #endif
}

extension Data {
  fileprivate mutating func appendASCII(_ string: String) {
    append(contentsOf: string.utf8)
  }

  fileprivate mutating func appendLittleEndian(_ value: UInt16) {
    append(contentsOf: value.littleEndianBytes)
  }

  fileprivate mutating func appendLittleEndian(_ value: UInt32) {
    append(contentsOf: value.littleEndianBytes)
  }

  fileprivate mutating func appendLittleEndian(_ value: UInt64) {
    append(contentsOf: value.littleEndianBytes)
  }

  fileprivate mutating func appendLittleEndian(_ value: Int32) {
    appendLittleEndian(UInt32(bitPattern: value))
  }
}

extension FixedWidthInteger {
  fileprivate var littleEndianBytes: [UInt8] {
    withUnsafeBytes(of: littleEndian) { Array($0) }
  }
}
