@preconcurrency import CoreBluetooth
import Foundation

enum NUSWriteStrategy {
  static func chunks(_ data: Data) -> [Data] {
    guard !data.isEmpty else { return [] }
    return stride(
      from: 0,
      to: data.count,
      by: RingSoundDefaults.nusWriteChunkSize
    ).map { offset in
      Data(
        data.dropFirst(offset)
          .prefix(RingSoundDefaults.nusWriteChunkSize)
      )
    }
  }
}

public final class NusClient: NSObject, RingSoundTransport, @unchecked Sendable {
  private final class WriteRequest {
    let chunks: [Data]
    let continuation: CheckedContinuation<Void, Error>
    var index = 0

    init(chunks: [Data], continuation: CheckedContinuation<Void, Error>) {
      self.chunks = chunks
      self.continuation = continuation
    }
  }

  public let identifier: UUID?
  public let writeWithResponse: Bool
  public let scanTimeout: TimeInterval

  private let serviceUUID: CBUUID
  private let transmitUUID: CBUUID
  private let receiveUUID: CBUUID
  private let bluetoothQueue = DispatchQueue(label: "RingSound.NusClient")
  private let callbackLock = NSLock()

  private var central: CBCentralManager!
  private var peripheral: CBPeripheral?
  private var transmitCharacteristic: CBCharacteristic?
  private var receiveCharacteristic: CBCharacteristic?
  private var connectContinuation: CheckedContinuation<Void, Error>?
  private var connectAttemptID: UUID?
  private var disconnectContinuation: CheckedContinuation<Void, Never>?
  private var writeRequests: [WriteRequest] = []
  private var activeWrite: WriteRequest?
  private var receiveHandler: (@Sendable (Data) -> Void)?
  private var disconnectHandler: (@Sendable () -> Void)?
  private var connectedState = false

  public init(
    identifier: UUID? = nil,
    serviceUUID: String = RingSoundUUID.service,
    transmitUUID: String = RingSoundUUID.transmit,
    receiveUUID: String = RingSoundUUID.receive,
    scanTimeout: TimeInterval = RingSoundDefaults.scanTimeout,
    writeWithResponse: Bool = false
  ) {
    self.identifier = identifier
    self.serviceUUID = CBUUID(string: serviceUUID)
    self.transmitUUID = CBUUID(string: transmitUUID)
    self.receiveUUID = CBUUID(string: receiveUUID)
    self.scanTimeout = scanTimeout
    self.writeWithResponse = writeWithResponse
    super.init()
    central = CBCentralManager(delegate: self, queue: bluetoothQueue)
  }

  public var isConnected: Bool {
    callbackLock.lock()
    defer { callbackLock.unlock() }
    return connectedState
  }

  public static func discover(
    identifier: UUID? = nil,
    timeout: TimeInterval = RingSoundDefaults.scanTimeout
  ) async throws -> [BLEDeviceInfo] {
    let session = BLEDiscoverySession(
      identifier: identifier,
      serviceUUID: CBUUID(string: RingSoundUUID.service),
      timeout: timeout
    )
    return try await session.run()
  }

  public func setReceiveHandler(
    _ handler: (@Sendable (Data) -> Void)?
  ) {
    callbackLock.lock()
    receiveHandler = handler
    callbackLock.unlock()
  }

  public func setDisconnectHandler(
    _ handler: (@Sendable () -> Void)?
  ) {
    callbackLock.lock()
    disconnectHandler = handler
    callbackLock.unlock()
  }

  public func connect() async throws {
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        bluetoothQueue.async { [weak self] in
          self?.beginConnect(continuation)
        }
      }
    } onCancel: {
      bluetoothQueue.async { [weak self] in
        self?.cancelPendingConnect()
      }
    }
  }

  public func disconnect() async {
    await withCheckedContinuation { continuation in
      bluetoothQueue.async { [weak self] in
        guard let self else {
          continuation.resume()
          return
        }
        self.beginDisconnect(continuation)
      }
    }
  }

  public func write(_ data: Data) async throws {
    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<Void, Error>) in
      bluetoothQueue.async { [weak self] in
        guard let self else {
          continuation.resume(
            throwing: RingSoundError.transport(
              "BLE transport was released"
            )
          )
          return
        }
        self.enqueueWrite(data, continuation: continuation)
      }
    }
  }

  private func beginConnect(
    _ continuation: CheckedContinuation<Void, Error>
  ) {
    if connectedState,
      peripheral?.state == .connected,
      receiveCharacteristic != nil,
      transmitCharacteristic != nil
    {
      continuation.resume()
      return
    }
    guard connectContinuation == nil else {
      continuation.resume(
        throwing: RingSoundError.transport(
          "A BLE connection attempt is already running"
        )
      )
      return
    }

    connectContinuation = continuation
    let attemptID = UUID()
    connectAttemptID = attemptID
    startConnectingWhenReady()
    bluetoothQueue.asyncAfter(
      deadline: .now() + max(0.001, scanTimeout)
    ) { [weak self] in
      guard let self, self.connectAttemptID == attemptID else { return }
      self.failConnect(
        RingSoundError.transport(
          "BLE connect timed out; no matching Ring Sound peripheral was ready"
        )
      )
    }
  }

  private func startConnectingWhenReady() {
    guard connectContinuation != nil else { return }
    switch central.state {
    case .poweredOn:
      if let identifier,
        let known = central.retrievePeripherals(
          withIdentifiers: [identifier]
        ).first
      {
        connect(to: known)
        return
      }
      if !central.isScanning {
        central.scanForPeripherals(
          withServices: identifier == nil ? [serviceUUID] : nil,
          options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
      }
    case .unknown, .resetting:
      break
    case .poweredOff:
      failConnect(
        RingSoundError.transport("Bluetooth is powered off")
      )
    case .unauthorized:
      failConnect(
        RingSoundError.transport("Bluetooth access is not authorized")
      )
    case .unsupported:
      failConnect(
        RingSoundError.transport("Bluetooth LE is not supported")
      )
    @unknown default:
      failConnect(
        RingSoundError.transport("Bluetooth is unavailable")
      )
    }
  }

  private func connect(to peripheral: CBPeripheral) {
    guard self.peripheral == nil else { return }
    central.stopScan()
    self.peripheral = peripheral
    peripheral.delegate = self
    central.connect(peripheral)
  }

  private func completeConnect() {
    guard let continuation = connectContinuation else { return }
    connectContinuation = nil
    connectAttemptID = nil
    setConnected(true)
    continuation.resume()
  }

  private func failConnect(_ error: Error) {
    central.stopScan()
    if let peripheral, peripheral.state != .disconnected {
      central.cancelPeripheralConnection(peripheral)
    }
    self.peripheral = nil
    transmitCharacteristic = nil
    receiveCharacteristic = nil
    connectAttemptID = nil
    setConnected(false)
    guard let continuation = connectContinuation else { return }
    connectContinuation = nil
    continuation.resume(throwing: error)
  }

  private func cancelPendingConnect() {
    guard connectContinuation != nil else { return }
    failConnect(CancellationError())
  }

  private func beginDisconnect(
    _ continuation: CheckedContinuation<Void, Never>
  ) {
    guard disconnectContinuation == nil else {
      continuation.resume()
      return
    }
    setConnected(false)
    failAllWrites(
      RingSoundError.transport("BLE disconnected during write")
    )
    guard let peripheral, peripheral.state != .disconnected else {
      clearPeripheralState()
      continuation.resume()
      return
    }

    disconnectContinuation = continuation
    central.cancelPeripheralConnection(peripheral)
    bluetoothQueue.asyncAfter(deadline: .now() + 3) { [weak self] in
      self?.completeDisconnectIfNeeded()
    }
  }

  private func completeDisconnectIfNeeded() {
    clearPeripheralState()
    guard let continuation = disconnectContinuation else { return }
    disconnectContinuation = nil
    continuation.resume()
  }

  private func clearPeripheralState() {
    peripheral = nil
    transmitCharacteristic = nil
    receiveCharacteristic = nil
    setConnected(false)
  }

  private func enqueueWrite(
    _ data: Data,
    continuation: CheckedContinuation<Void, Error>
  ) {
    guard connectedState,
      let peripheral,
      peripheral.state == .connected,
      receiveCharacteristic != nil
    else {
      continuation.resume(
        throwing: RingSoundError.transport(
          "BLE client is not connected"
        )
      )
      return
    }

    writeRequests.append(
      WriteRequest(
        chunks: NUSWriteStrategy.chunks(data),
        continuation: continuation
      )
    )
    processWrites()
  }

  private func processWrites() {
    if activeWrite == nil, !writeRequests.isEmpty {
      activeWrite = writeRequests.removeFirst()
    }
    guard let request = activeWrite else { return }
    guard connectedState,
      let peripheral,
      let receiveCharacteristic
    else {
      finishActiveWrite(
        .failure(
          RingSoundError.transport(
            "BLE disconnected during write"
          )
        )
      )
      return
    }
    guard request.index < request.chunks.count else {
      finishActiveWrite(.success(()))
      return
    }

    if writeWithResponse {
      peripheral.writeValue(
        request.chunks[request.index],
        for: receiveCharacteristic,
        type: .withResponse
      )
      return
    }

    while request.index < request.chunks.count,
      peripheral.canSendWriteWithoutResponse
    {
      peripheral.writeValue(
        request.chunks[request.index],
        for: receiveCharacteristic,
        type: .withoutResponse
      )
      request.index += 1
    }
    if request.index == request.chunks.count {
      finishActiveWrite(.success(()))
    }
  }

  private func finishActiveWrite(_ result: Result<Void, Error>) {
    guard let request = activeWrite else { return }
    activeWrite = nil
    switch result {
    case .success:
      request.continuation.resume()
    case .failure(let error):
      request.continuation.resume(throwing: error)
    }
    processWrites()
  }

  private func failAllWrites(_ error: Error) {
    if let activeWrite {
      activeWrite.continuation.resume(throwing: error)
      self.activeWrite = nil
    }
    let queued = writeRequests
    writeRequests.removeAll()
    queued.forEach { $0.continuation.resume(throwing: error) }
  }

  private func setConnected(_ value: Bool) {
    callbackLock.lock()
    connectedState = value
    callbackLock.unlock()
  }

  private func emitReceived(_ data: Data) {
    callbackLock.lock()
    let handler = receiveHandler
    callbackLock.unlock()
    handler?(data)
  }

  private func emitDisconnected() {
    callbackLock.lock()
    let handler = disconnectHandler
    callbackLock.unlock()
    handler?()
  }
}

extension NusClient: CBCentralManagerDelegate {
  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    startConnectingWhenReady()
  }

  public func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    guard connectContinuation != nil else { return }
    if let identifier, peripheral.identifier != identifier {
      return
    }
    connect(to: peripheral)
  }

  public func centralManager(
    _ central: CBCentralManager,
    didConnect peripheral: CBPeripheral
  ) {
    peripheral.discoverServices([serviceUUID])
  }

  public func centralManager(
    _ central: CBCentralManager,
    didFailToConnect peripheral: CBPeripheral,
    error: Error?
  ) {
    failConnect(
      RingSoundError.transport(
        "BLE connect failed: \(error?.localizedDescription ?? "unknown error")"
      )
    )
  }

  public func centralManager(
    _ central: CBCentralManager,
    didDisconnectPeripheral peripheral: CBPeripheral,
    error: Error?
  ) {
    if connectContinuation != nil {
      failConnect(
        RingSoundError.transport(
          "BLE disconnected while connecting: \(error?.localizedDescription ?? "unknown error")"
        )
      )
    }
    setConnected(false)
    failAllWrites(
      RingSoundError.transport("BLE disconnected during write")
    )
    completeDisconnectIfNeeded()
    emitDisconnected()
  }
}

extension NusClient: CBPeripheralDelegate {
  public func peripheral(
    _ peripheral: CBPeripheral,
    didDiscoverServices error: Error?
  ) {
    if let error {
      failConnect(
        RingSoundError.transport(
          "NUS service discovery failed: \(error.localizedDescription)"
        )
      )
      return
    }
    guard
      let service = peripheral.services?.first(
        where: { $0.uuid == serviceUUID }
      )
    else {
      failConnect(
        RingSoundError.transport(
          "Ring Sound Nordic UART service was not found"
        )
      )
      return
    }
    peripheral.discoverCharacteristics(
      [transmitUUID, receiveUUID],
      for: service
    )
  }

  public func peripheral(
    _ peripheral: CBPeripheral,
    didDiscoverCharacteristicsFor service: CBService,
    error: Error?
  ) {
    if let error {
      failConnect(
        RingSoundError.transport(
          "NUS characteristic discovery failed: \(error.localizedDescription)"
        )
      )
      return
    }
    transmitCharacteristic = service.characteristics?.first {
      $0.uuid == transmitUUID
    }
    receiveCharacteristic = service.characteristics?.first {
      $0.uuid == receiveUUID
    }
    guard let transmitCharacteristic, receiveCharacteristic != nil else {
      failConnect(
        RingSoundError.transport(
          "Ring Sound NUS TX/RX characteristics were not found"
        )
      )
      return
    }
    peripheral.setNotifyValue(true, for: transmitCharacteristic)
  }

  public func peripheral(
    _ peripheral: CBPeripheral,
    didUpdateNotificationStateFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    guard characteristic.uuid == transmitUUID else { return }
    if let error {
      failConnect(
        RingSoundError.transport(
          "NUS notification setup failed: \(error.localizedDescription)"
        )
      )
    } else if characteristic.isNotifying {
      completeConnect()
    } else {
      failConnect(
        RingSoundError.transport(
          "NUS TX characteristic did not enable notifications"
        )
      )
    }
  }

  public func peripheral(
    _ peripheral: CBPeripheral,
    didUpdateValueFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    guard characteristic.uuid == transmitUUID,
      error == nil,
      let value = characteristic.value
    else {
      return
    }
    emitReceived(value)
  }

  public func peripheral(
    _ peripheral: CBPeripheral,
    didWriteValueFor characteristic: CBCharacteristic,
    error: Error?
  ) {
    guard writeWithResponse,
      characteristic.uuid == receiveUUID,
      let request = activeWrite
    else {
      return
    }
    if let error {
      finishActiveWrite(
        .failure(
          RingSoundError.transport(
            "BLE write failed: \(error.localizedDescription)"
          )
        )
      )
      return
    }
    request.index += 1
    processWrites()
  }

  public func peripheralIsReady(
    toSendWriteWithoutResponse peripheral: CBPeripheral
  ) {
    processWrites()
  }
}

private final class BLEDiscoverySession:
  NSObject,
  CBCentralManagerDelegate,
  @unchecked Sendable
{
  private let identifier: UUID?
  private let serviceUUID: CBUUID
  private let timeout: TimeInterval
  private let queue = DispatchQueue(label: "RingSound.BLEDiscovery")
  private var central: CBCentralManager?
  private var continuation: CheckedContinuation<[BLEDeviceInfo], Error>?
  private var results: [UUID: BLEDeviceInfo] = [:]
  private var timeoutID: UUID?

  init(identifier: UUID?, serviceUUID: CBUUID, timeout: TimeInterval) {
    self.identifier = identifier
    self.serviceUUID = serviceUUID
    self.timeout = timeout
  }

  func run() async throws -> [BLEDeviceInfo] {
    try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        queue.async { [weak self] in
          guard let self else {
            continuation.resume(throwing: CancellationError())
            return
          }
          self.continuation = continuation
          let timeoutID = UUID()
          self.timeoutID = timeoutID
          self.central = CBCentralManager(
            delegate: self,
            queue: self.queue
          )
          self.queue.asyncAfter(
            deadline: .now() + max(0, self.timeout)
          ) { [weak self] in
            guard let self, self.timeoutID == timeoutID else {
              return
            }
            self.finish(.success(self.sortedResults))
          }
        }
      }
    } onCancel: {
      queue.async { [weak self] in
        self?.finish(.failure(CancellationError()))
      }
    }
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard continuation != nil else { return }
    switch central.state {
    case .poweredOn:
      central.scanForPeripherals(
        withServices: identifier == nil ? [serviceUUID] : nil,
        options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
      )
    case .unknown, .resetting:
      break
    case .poweredOff:
      finish(
        .failure(RingSoundError.transport("Bluetooth is powered off"))
      )
    case .unauthorized:
      finish(
        .failure(
          RingSoundError.transport(
            "Bluetooth access is not authorized"
          )
        )
      )
    case .unsupported:
      finish(
        .failure(
          RingSoundError.transport("Bluetooth LE is not supported")
        )
      )
    @unknown default:
      finish(
        .failure(RingSoundError.transport("Bluetooth is unavailable"))
      )
    }
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    if let identifier, peripheral.identifier != identifier {
      return
    }
    let advertisedName =
      advertisementData[CBAdvertisementDataLocalNameKey] as? String
    results[peripheral.identifier] = BLEDeviceInfo(
      name: advertisedName ?? peripheral.name,
      address: peripheral.identifier.uuidString,
      rssi: RSSI.intValue
    )
    if identifier != nil {
      finish(.success(sortedResults))
    }
  }

  private var sortedResults: [BLEDeviceInfo] {
    results.values.sorted { $0.address < $1.address }
  }

  private func finish(_ result: Result<[BLEDeviceInfo], Error>) {
    guard let continuation else { return }
    self.continuation = nil
    timeoutID = nil
    central?.stopScan()
    switch result {
    case .success(let devices):
      continuation.resume(returning: devices)
    case .failure(let error):
      continuation.resume(throwing: error)
    }
  }
}
