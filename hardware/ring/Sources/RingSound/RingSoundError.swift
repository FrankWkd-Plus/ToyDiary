import Foundation

public enum RingSoundError: Error, Equatable, Sendable {
  case transport(String)
  case protocolError(String)
  case timeout(command: UInt16)
  case device(code: UInt16, message: String)
  case audioDecode(String)
  case speexDecoderUnavailable(String)
}

extension RingSoundError: LocalizedError {
  public var errorDescription: String? {
    switch self {
    case .transport(let message),
      .protocolError(let message),
      .audioDecode(let message),
      .speexDecoderUnavailable(let message):
      message
    case .timeout(let command):
      String(format: "Timed out waiting for command 0x%04X", command)
    case .device(_, let message):
      message
    }
  }
}

@inline(__always)
func ensureSuccess(_ code: UInt16) throws {
  guard code != ErrorCode.success.rawValue else { return }
  let message = ErrorCode(rawValue: code)?.message ?? "device error \(code)"
  throw RingSoundError.device(code: code, message: message)
}
