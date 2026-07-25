import Foundation

public enum RingSoundSDK {
  public static let version = "0.4.1"
}

public enum RingSoundUUID {
  public static let service = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
  public static let transmit = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
  public static let receive = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
}

public enum RingSoundDefaults {
  public static let scanTimeout: TimeInterval = 25
  public static let commandTimeout: TimeInterval = 10
  public static let nusWriteChunkSize = 20
  public static let sampleRate = 16_000
  public static let channels = 1
  public static let bitDepth = 16
  public static let speexFrameSize = 320
  public static let speexMaximumPacketSize = 540
  public static let speexQuality = 3
  public static let legacyOuterFrameSize = 1_026
}

public enum RingSoundPacketConstants {
  public static let magic: UInt8 = 0x3f
  public static let protocolVersion: UInt16 = 4
  public static let headerSize = 11
  public static let maximumBodyLength = 5_120
}

public enum ErrorCode: UInt16, CaseIterable, Sendable {
  case success = 0
  case unknown = 1
  case deviceBusy = 2
  case fileNotExist = 3
  case commandGroupNotExist = 4
  case commandNotExist = 5
  case timeout = 6
  case invalidParameter = 7
  case communication = 8

  public var message: String {
    switch self {
    case .success: "success"
    case .unknown: "unknown error"
    case .deviceBusy: "device busy"
    case .fileNotExist: "file not exist"
    case .commandGroupNotExist: "command group not exist"
    case .commandNotExist: "command not exist"
    case .timeout: "operation timeout"
    case .invalidParameter: "invalid parameter"
    case .communication: "communication error"
    }
  }
}

public enum SystemCommand: UInt16, Sendable {
  case getInfo = 0x0101
  case infoResponse = 0x0102
}

public enum LogCommand: UInt16, Sendable {
  case getStorage = 0x0301
  case storageResponse = 0x0302
  case getLog = 0x0303
  case logResponse = 0x0304
}

public enum TimeCommand: UInt16, Sendable {
  case request = 0x0401
  case response = 0x0402
}

public enum AudioCommand: UInt16, Sendable {
  case getList = 0x0501
  case listResponse = 0x0502
  case startExtract = 0x0503
  case fileInfoResponse = 0x0504
  case dataFrame = 0x0505
  case nextFrame = 0x0506
  case endExtract = 0x0507
  case extractDone = 0x0508
  case startExtractQuick = 0x0509
  case clearAll = 0x050b
  case clearAllResponse = 0x050c
}

public enum SensorCommand: UInt16, Sendable {
  case startReport = 0x0601
  case startReportResponse = 0x0602
  case stopReport = 0x0603
  case stopReportResponse = 0x0604
  case dataFrame = 0x0605
  case doubleTap = 0x0701
  case gesture = 0x0702
  case keyDoublePress = 0x0703
  case keySinglePress = 0x0704
}

public enum SensorGestureID: UInt8, Sendable {
  case idle = 0
  case rotateBack = 1
  case rotateFront = 2
  case wave = 3
}
