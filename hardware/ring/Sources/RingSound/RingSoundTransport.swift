import Foundation

public protocol RingSoundTransport: AnyObject, Sendable {
  var isConnected: Bool { get }

  func setReceiveHandler(_ handler: (@Sendable (Data) -> Void)?)
  func setDisconnectHandler(_ handler: (@Sendable () -> Void)?)
  func connect() async throws
  func disconnect() async
  func write(_ data: Data) async throws
}

public struct PacketHandlerToken: Hashable, Sendable {
  public let command: UInt16
  public let id: UUID

  public init(command: UInt16, id: UUID = UUID()) {
    self.command = command
    self.id = id
  }
}

public typealias AudioProgressHandler =
  @Sendable (_ receivedBytes: Int, _ totalBytes: Int) -> Void
