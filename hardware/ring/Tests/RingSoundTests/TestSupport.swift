import Foundation

@testable import RingSound

extension Data {
  init?(hex: String) {
    guard hex.count.isMultiple(of: 2) else { return nil }
    var result = Data()
    var index = hex.startIndex
    while index < hex.endIndex {
      let next = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
      result.append(byte)
      index = next
    }
    self = result
  }

  var hexString: String {
    map { String(format: "%02x", $0) }.joined()
  }

  func littleEndianUInt32(at offset: Int) -> UInt32 {
    let bytes = Array(self[offset..<(offset + 4)])
    return UInt32(bytes[0])
      | (UInt32(bytes[1]) << 8)
      | (UInt32(bytes[2]) << 16)
      | (UInt32(bytes[3]) << 24)
  }
}

final class MockTransport: RingSoundTransport, @unchecked Sendable {
  private let lock = NSLock()
  private var receiveHandler: (@Sendable (Data) -> Void)?
  private var disconnectHandler: (@Sendable () -> Void)?
  private var connected = false
  private var capturedWrites: [Data] = []

  var onWrite: (@Sendable (Data) async throws -> Void)?

  var isConnected: Bool {
    lock.withLock { connected }
  }

  var writes: [Data] {
    lock.withLock { capturedWrites }
  }

  func setReceiveHandler(_ handler: (@Sendable (Data) -> Void)?) {
    lock.withLock { receiveHandler = handler }
  }

  func setDisconnectHandler(_ handler: (@Sendable () -> Void)?) {
    lock.withLock { disconnectHandler = handler }
  }

  func connect() async throws {
    lock.withLock { connected = true }
  }

  func disconnect() async {
    let callback = lock.withLock { () -> (@Sendable () -> Void)? in
      connected = false
      return disconnectHandler
    }
    callback?()
  }

  func write(_ data: Data) async throws {
    lock.withLock { capturedWrites.append(data) }
    try await onWrite?(data)
  }

  func push(_ data: Data) {
    let callback = lock.withLock { receiveHandler }
    callback?(data)
  }

  func dropConnection() {
    let callback = lock.withLock { () -> (@Sendable () -> Void)? in
      connected = false
      return disconnectHandler
    }
    callback?()
  }
}

extension NSLock {
  fileprivate func withLock<T>(_ body: () throws -> T) rethrows -> T {
    lock()
    defer { unlock() }
    return try body()
  }
}
