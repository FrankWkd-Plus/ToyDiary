import Foundation

public actor RingSoundClient {
  private struct Waiter {
    let id: UUID
    let continuation: CheckedContinuation<Packet, Error>
  }

  public let commandTimeout: TimeInterval
  private let transport: any RingSoundTransport
  private var stream = PacketStream()
  private var packetQueues: [UInt16: [Packet]] = [:]
  private var waiters: [UInt16: [Waiter]] = [:]
  private var handlers: [UInt16: [UUID: @Sendable (Packet) async -> Void]] = [:]
  private var pendingProtocolErrors: [RingSoundError] = []
  private var connected = false

  public init(
    transport: any RingSoundTransport,
    commandTimeout: TimeInterval = RingSoundDefaults.commandTimeout
  ) {
    self.transport = transport
    self.commandTimeout = commandTimeout
  }

  public init(
    identifier: UUID? = nil,
    commandTimeout: TimeInterval = RingSoundDefaults.commandTimeout,
    writeWithResponse: Bool = false
  ) {
    transport = NusClient(
      identifier: identifier,
      writeWithResponse: writeWithResponse
    )
    self.commandTimeout = commandTimeout
  }

  public var isConnected: Bool {
    connected && transport.isConnected
  }

  public func connect() async throws {
    resetReceiveState()
    connected = false
    transport.setReceiveHandler { [weak self] data in
      Task { await self?.receive(data) }
    }
    transport.setDisconnectHandler { [weak self] in
      Task { await self?.transportDisconnected() }
    }
    do {
      try await transport.connect()
      connected = true
    } catch {
      connected = false
      throw error
    }
  }

  public func disconnect() async {
    await transport.disconnect()
    transportDisconnected()
  }

  public func sendCommand(_ command: UInt16, body: Data = Data()) async throws {
    guard connected, transport.isConnected else {
      throw RingSoundError.transport("BLE client is not connected")
    }
    try await transport.write(
      RingSoundProtocol.encodePacket(command: command, body: body)
    )
  }

  public func sendCommand<C: RawRepresentable>(
    _ command: C,
    body: Data = Data()
  ) async throws where C.RawValue == UInt16 {
    try await sendCommand(command.rawValue, body: body)
  }

  public func request(
    command: UInt16,
    responseCommand: UInt16,
    body: Data = Data(),
    timeout: TimeInterval? = nil
  ) async throws -> Packet {
    drainCommandQueue(responseCommand)
    pendingProtocolErrors.removeAll(keepingCapacity: true)
    try await sendCommand(command, body: body)
    return try await waitForCommand(responseCommand, timeout: timeout)
  }

  public func request<Request: RawRepresentable, Response: RawRepresentable>(
    command: Request,
    responseCommand: Response,
    body: Data = Data(),
    timeout: TimeInterval? = nil
  ) async throws -> Packet
  where Request.RawValue == UInt16, Response.RawValue == UInt16 {
    try await request(
      command: command.rawValue,
      responseCommand: responseCommand.rawValue,
      body: body,
      timeout: timeout
    )
  }

  public func waitForCommand(
    _ command: UInt16,
    timeout: TimeInterval? = nil
  ) async throws -> Packet {
    if !pendingProtocolErrors.isEmpty {
      throw pendingProtocolErrors.removeFirst()
    }
    if var queued = packetQueues[command], !queued.isEmpty {
      let packet = queued.removeFirst()
      packetQueues[command] = queued
      return packet
    }
    guard connected, transport.isConnected else {
      throw RingSoundError.transport(
        String(
          format: "BLE disconnected while waiting for command 0x%04X",
          command
        )
      )
    }

    let waiterID = UUID()
    let interval = max(0, timeout ?? commandTimeout)
    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        waiters[command, default: []].append(
          Waiter(id: waiterID, continuation: continuation)
        )
        Task { [weak self] in
          let nanoseconds = UInt64(
            min(interval, TimeInterval(UInt64.max) / 1_000_000_000)
              * 1_000_000_000
          )
          try? await Task.sleep(nanoseconds: nanoseconds)
          guard !Task.isCancelled else { return }
          await self?.timeoutWaiter(id: waiterID, command: command)
        }
      }
    } onCancel: {
      Task { [weak self] in
        await self?.cancelWaiter(id: waiterID, command: command)
      }
    }
  }

  public func waitForCommand<C: RawRepresentable>(
    _ command: C,
    timeout: TimeInterval? = nil
  ) async throws -> Packet where C.RawValue == UInt16 {
    try await waitForCommand(command.rawValue, timeout: timeout)
  }

  @discardableResult
  public func addPacketHandler(
    command: UInt16,
    handler: @escaping @Sendable (Packet) async -> Void
  ) -> PacketHandlerToken {
    let token = PacketHandlerToken(command: command)
    handlers[command, default: [:]][token.id] = handler
    return token
  }

  @discardableResult
  public func addPacketHandler<C: RawRepresentable>(
    command: C,
    handler: @escaping @Sendable (Packet) async -> Void
  ) -> PacketHandlerToken where C.RawValue == UInt16 {
    addPacketHandler(command: command.rawValue, handler: handler)
  }

  public func removePacketHandler(_ token: PacketHandlerToken) {
    handlers[token.command]?[token.id] = nil
    if handlers[token.command]?.isEmpty == true {
      handlers[token.command] = nil
    }
  }

  func drainCommandQueue(_ command: UInt16) {
    packetQueues[command] = []
  }

  private func receive(_ data: Data) {
    do {
      let packets = try stream.feed(data)
      for packet in packets {
        route(packet)
      }
    } catch let error as RingSoundError {
      stream.clear()
      failForProtocolError(error)
    } catch {
      stream.clear()
      failForProtocolError(
        .protocolError("Packet stream failed: \(error.localizedDescription)")
      )
    }
  }

  private func route(_ packet: Packet) {
    if var commandWaiters = waiters[packet.command],
      !commandWaiters.isEmpty
    {
      let waiter = commandWaiters.removeFirst()
      waiters[packet.command] =
        commandWaiters.isEmpty ? nil : commandWaiters
      waiter.continuation.resume(returning: packet)
    } else {
      packetQueues[packet.command, default: []].append(packet)
    }

    for handler in handlers[packet.command]?.values ?? [:].values {
      Task { await handler(packet) }
    }
  }

  private func timeoutWaiter(id: UUID, command: UInt16) {
    guard let waiter = removeWaiter(id: id, command: command) else { return }
    waiter.continuation.resume(
      throwing: RingSoundError.timeout(command: command)
    )
  }

  private func cancelWaiter(id: UUID, command: UInt16) {
    guard let waiter = removeWaiter(id: id, command: command) else { return }
    waiter.continuation.resume(throwing: CancellationError())
  }

  private func removeWaiter(id: UUID, command: UInt16) -> Waiter? {
    guard var commandWaiters = waiters[command],
      let index = commandWaiters.firstIndex(where: { $0.id == id })
    else {
      return nil
    }
    let waiter = commandWaiters.remove(at: index)
    waiters[command] = commandWaiters.isEmpty ? nil : commandWaiters
    return waiter
  }

  private func failForProtocolError(_ error: RingSoundError) {
    let allWaiters = waiters.values.flatMap { $0 }
    waiters.removeAll(keepingCapacity: true)
    if allWaiters.isEmpty {
      pendingProtocolErrors.append(error)
    } else {
      allWaiters.forEach { $0.continuation.resume(throwing: error) }
    }
  }

  private func transportDisconnected() {
    guard connected || !waiters.isEmpty else { return }
    connected = false
    stream.clear()
    packetQueues.removeAll(keepingCapacity: true)
    pendingProtocolErrors.removeAll(keepingCapacity: true)
    let error = RingSoundError.transport("BLE disconnected")
    let allWaiters = waiters.values.flatMap { $0 }
    waiters.removeAll(keepingCapacity: true)
    allWaiters.forEach { $0.continuation.resume(throwing: error) }
  }

  private func resetReceiveState() {
    stream.clear()
    packetQueues.removeAll(keepingCapacity: true)
    pendingProtocolErrors.removeAll(keepingCapacity: true)
    let allWaiters = waiters.values.flatMap { $0 }
    waiters.removeAll(keepingCapacity: true)
    allWaiters.forEach {
      $0.continuation.resume(
        throwing: RingSoundError.transport("BLE connection was reset")
      )
    }
  }
}
