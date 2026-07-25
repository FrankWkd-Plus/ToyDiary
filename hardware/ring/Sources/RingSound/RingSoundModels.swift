import Foundation

public struct BLEDeviceInfo: Equatable, Sendable {
  public let name: String?
  /// Apple platforms expose a host-specific CoreBluetooth peripheral UUID here,
  /// not the hardware MAC address used by bleak.
  public let address: String
  public let rssi: Int?

  public init(name: String?, address: String, rssi: Int? = nil) {
    self.name = name
    self.address = address
    self.rssi = rssi
  }
}

public struct Packet: Equatable, Sendable {
  public let command: UInt16
  public let body: Data
  public let version: UInt16
  public let bodyCRC: UInt16

  public init(
    command: UInt16,
    body: Data,
    version: UInt16 = RingSoundPacketConstants.protocolVersion,
    bodyCRC: UInt16 = 0
  ) {
    self.command = command
    self.body = body
    self.version = version
    self.bodyCRC = bodyCRC
  }
}

public struct SystemInfo: Equatable, Sendable {
  public let firmwareVersion: String
  public let systemTime: UInt32
  public let audioStorageTotal: UInt32
  public let audioStorageAvailable: UInt32
  public let batteryPercent: UInt16
  public let batteryCharging: Bool
  public let serialNumber: String
  public let cpuID: String
  public let model: String

  public init(
    firmwareVersion: String,
    systemTime: UInt32,
    audioStorageTotal: UInt32,
    audioStorageAvailable: UInt32,
    batteryPercent: UInt16,
    batteryCharging: Bool,
    serialNumber: String,
    cpuID: String,
    model: String
  ) {
    self.firmwareVersion = firmwareVersion
    self.systemTime = systemTime
    self.audioStorageTotal = audioStorageTotal
    self.audioStorageAvailable = audioStorageAvailable
    self.batteryPercent = batteryPercent
    self.batteryCharging = batteryCharging
    self.serialNumber = serialNumber
    self.cpuID = cpuID
    self.model = model
  }
}

public struct LogStorageInfo: Equatable, Sendable {
  public let pageSize: UInt32
  public let totalLength: UInt32

  public init(pageSize: UInt32, totalLength: UInt32) {
    self.pageSize = pageSize
    self.totalLength = totalLength
  }
}

public struct AudioFileInfo: Equatable, Sendable {
  public let fileIndex: UInt32
  public let recordTime: UInt32
  public let dataSize: UInt32

  public init(fileIndex: UInt32, recordTime: UInt32, dataSize: UInt32) {
    self.fileIndex = fileIndex
    self.recordTime = recordTime
    self.dataSize = dataSize
  }
}

public struct AudioDataFrame: Equatable, Sendable {
  public let fileIndex: UInt32
  public let frameOffset: UInt32
  public let frameSize: UInt32
  public let isEnd: Bool
  public let data: Data

  public init(
    fileIndex: UInt32,
    frameOffset: UInt32,
    frameSize: UInt32,
    isEnd: Bool,
    data: Data
  ) {
    self.fileIndex = fileIndex
    self.frameOffset = frameOffset
    self.frameSize = frameSize
    self.isEnd = isEnd
    self.data = data
  }
}

public struct PCMConfig: Equatable, Sendable, CustomStringConvertible {
  public let sampleRate: Int
  public let channels: Int
  public let bitDepth: Int

  public init(
    sampleRate: Int = RingSoundDefaults.sampleRate,
    channels: Int = RingSoundDefaults.channels,
    bitDepth: Int = RingSoundDefaults.bitDepth
  ) {
    self.sampleRate = max(1, sampleRate)
    self.channels = channels > 1 ? 2 : 1
    self.bitDepth = bitDepth == 8 ? 8 : 16
  }

  public var description: String {
    "\(sampleRate)Hz / \(channels)ch / \(bitDepth)bit"
  }
}

public struct SpeexDecodeOptions: Equatable, Sendable {
  public let pcmConfig: PCMConfig
  public let quality: Int
  public let bitsSize: Int?
  public let allowFramedBlocks: Bool
  public let ffmpegPath: String

  public init(
    pcmConfig: PCMConfig,
    quality: Int,
    bitsSize: Int?,
    allowFramedBlocks: Bool,
    ffmpegPath: String
  ) {
    self.pcmConfig = pcmConfig
    self.quality = quality
    self.bitsSize = bitsSize
    self.allowFramedBlocks = allowFramedBlocks
    self.ffmpegPath = ffmpegPath
  }
}

public struct SpeexDecodeResult: Equatable, Sendable {
  public let pcmData: Data
  public let pcmConfig: PCMConfig
  public let sourceType: String
  public let sourceExtension: String
  public let packetCount: Int

  public init(
    pcmData: Data,
    pcmConfig: PCMConfig,
    sourceType: String = "speex",
    sourceExtension: String = "spx",
    packetCount: Int = 0
  ) {
    self.pcmData = pcmData
    self.pcmConfig = pcmConfig
    self.sourceType = sourceType
    self.sourceExtension = sourceExtension
    self.packetCount = packetCount
  }
}

public typealias SpeexDecoder =
  @Sendable (_ data: Data, _ options: SpeexDecodeOptions) throws -> SpeexDecodeResult

public struct PlayableAudio: Equatable, Sendable {
  public let data: Data
  public let fileExtension: String
  public let mimeType: String
  public let playMode: String
  public let label: String
  public let pcmConfig: PCMConfig?
  public let sourceType: String
  public let sourceExtension: String
  public let sourceMIMEType: String
  public let description: String

  public init(
    data: Data,
    fileExtension: String,
    mimeType: String,
    playMode: String,
    label: String,
    pcmConfig: PCMConfig? = nil,
    sourceType: String = "raw",
    sourceExtension: String = "bin",
    sourceMIMEType: String = "application/octet-stream",
    description: String = ""
  ) {
    self.data = data
    self.fileExtension = fileExtension
    self.mimeType = mimeType
    self.playMode = playMode
    self.label = label
    self.pcmConfig = pcmConfig
    self.sourceType = sourceType
    self.sourceExtension = sourceExtension
    self.sourceMIMEType = sourceMIMEType
    self.description = description
  }
}

public struct AudioBundle: Equatable, Sendable {
  public let rawURL: URL
  public let rawFileName: String
  public let playableURL: URL
  public let playableFileName: String
  public let playMode: String
  public let formatLabel: String
  public let playDescription: String
  public let pcmSummary: String
  public let rawSize: Int
  public let playableSize: Int
  public let sourceType: String
  public let sourceExtension: String
}

public struct SensorStartInfo: Equatable, Sendable {
  public let sampleRateHz: UInt16
  public let accelerationRangeG: UInt16
  public let gyroscopeRangeDPS: UInt16

  public init(sampleRateHz: UInt16, accelerationRangeG: UInt16, gyroscopeRangeDPS: UInt16) {
    self.sampleRateHz = sampleRateHz
    self.accelerationRangeG = accelerationRangeG
    self.gyroscopeRangeDPS = gyroscopeRangeDPS
  }
}

public struct SensorStopInfo: Equatable, Sendable {
  public init() {}
}

public struct SensorDataSample: Equatable, Sendable {
  public let timestampMilliseconds: UInt32
  public let accelerationX: Int16
  public let accelerationY: Int16
  public let accelerationZ: Int16
  public let gyroscopeX: Int16
  public let gyroscopeY: Int16
  public let gyroscopeZ: Int16

  public init(
    timestampMilliseconds: UInt32,
    accelerationX: Int16,
    accelerationY: Int16,
    accelerationZ: Int16,
    gyroscopeX: Int16,
    gyroscopeY: Int16,
    gyroscopeZ: Int16
  ) {
    self.timestampMilliseconds = timestampMilliseconds
    self.accelerationX = accelerationX
    self.accelerationY = accelerationY
    self.accelerationZ = accelerationZ
    self.gyroscopeX = gyroscopeX
    self.gyroscopeY = gyroscopeY
    self.gyroscopeZ = gyroscopeZ
  }
}

public struct SensorDataBatch: Equatable, Sendable {
  public let sequenceStart: UInt32
  public let frameCount: UInt16
  public let sampleSize: UInt16
  public let samples: [SensorDataSample]

  public init(
    sequenceStart: UInt32,
    frameCount: UInt16,
    sampleSize: UInt16,
    samples: [SensorDataSample]
  ) {
    self.sequenceStart = sequenceStart
    self.frameCount = frameCount
    self.sampleSize = sampleSize
    self.samples = samples
  }
}

public struct SensorDoubleTapEvent: Equatable, Sendable {
  public let timestampMilliseconds: UInt32
  public init(timestampMilliseconds: UInt32) {
    self.timestampMilliseconds = timestampMilliseconds
  }
}

public struct SensorGestureEvent: Equatable, Sendable {
  public let timestampMilliseconds: UInt32
  public let gestureID: UInt8

  public init(timestampMilliseconds: UInt32, gestureID: UInt8) {
    self.timestampMilliseconds = timestampMilliseconds
    self.gestureID = gestureID
  }
}

public struct SensorKeyDoublePressEvent: Equatable, Sendable {
  public let timestampMilliseconds: UInt32
  public init(timestampMilliseconds: UInt32) {
    self.timestampMilliseconds = timestampMilliseconds
  }
}

public struct SensorKeySinglePressEvent: Equatable, Sendable {
  public let timestampMilliseconds: UInt32
  public init(timestampMilliseconds: UInt32) {
    self.timestampMilliseconds = timestampMilliseconds
  }
}

public struct DownloadedAudioFile: Equatable, Sendable {
  public let info: AudioFileInfo
  public let data: Data

  public init(info: AudioFileInfo, data: Data) {
    self.info = info
    self.data = data
  }
}

public struct AutoReceivedAudioFile: Equatable, Sendable {
  public let fileIndex: UInt32
  public let data: Data

  public init(fileIndex: UInt32, data: Data) {
    self.fileIndex = fileIndex
    self.data = data
  }
}
