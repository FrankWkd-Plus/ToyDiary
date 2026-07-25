import Foundation
import XCTest

@testable import RingSound

final class ClientTests: XCTestCase {
  func testRequestWritesCommandAndRoutesFragmentedResponse() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 1)
    try await client.connect()
    let response = RingSoundProtocol.encodePacket(command: 0x0102, body: Data([0, 0]))
    transport.onWrite = { request in
      XCTAssertEqual(try RingSoundProtocol.decodePacket(request).command, 0x0101)
      transport.push(Data(response.prefix(5)))
      transport.push(Data(response.dropFirst(5)))
    }

    let packet = try await client.request(command: 0x0101, responseCommand: 0x0102)

    XCTAssertEqual(packet.command, 0x0102)
    XCTAssertEqual(packet.body, Data([0, 0]))
  }

  func testWaitTimesOutWithCommand() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 0.01)
    try await client.connect()

    do {
      _ = try await client.waitForCommand(0x0701)
      XCTFail("Expected timeout")
    } catch let RingSoundError.timeout(command) {
      XCTAssertEqual(command, 0x0701)
    }
  }

  func testDisconnectFailsPendingWait() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 5)
    try await client.connect()

    let waiting = Task { try await client.waitForCommand(0x0702) }
    try await Task.sleep(nanoseconds: 5_000_000)
    transport.dropConnection()

    do {
      _ = try await waiting.value
      XCTFail("Expected transport error")
    } catch let RingSoundError.transport(message) {
      XCTAssertTrue(message.contains("disconnected"))
    }
  }

  func testQueuedPacketIsAvailableToLaterWaiter() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 1)
    try await client.connect()
    transport.push(RingSoundProtocol.encodePacket(command: 0x0701, body: Data([0, 0, 0, 7])))
    try await Task.sleep(nanoseconds: 5_000_000)

    let packet = try await client.waitForCommand(0x0701)

    XCTAssertEqual(try RingSoundParsers.doubleTapEvent(packet.body).timestampMilliseconds, 7)
  }

  func testPacketHandlerReceivesEvents() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 1)
    try await client.connect()
    let expectation = expectation(description: "handler")
    let token = await client.addPacketHandler(command: 0x0701) { packet in
      if packet.body == Data([0, 0, 0, 8]) {
        expectation.fulfill()
      }
    }

    transport.push(RingSoundProtocol.encodePacket(command: 0x0701, body: Data([0, 0, 0, 8])))
    await fulfillment(of: [expectation], timeout: 1)
    await client.removePacketHandler(token)
  }

  func testHighLevelSystemInfoUsesExpectedCommands() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 1)
    try await client.connect()
    let body = Data(
      hex: "0000000456322e300000007b000003e8000001900055010002534e0003435055000452696e67"
    )!
    transport.onWrite = { request in
      XCTAssertEqual(
        try RingSoundProtocol.decodePacket(request).command, SystemCommand.getInfo.rawValue)
      transport.push(
        RingSoundProtocol.encodePacket(command: SystemCommand.infoResponse.rawValue, body: body))
    }

    let info = try await client.getSystemInfo()

    XCTAssertEqual(info.serialNumber, "SN")
  }

  func testAudioFrameRequestIncludesFirmwarePadding() async throws {
    let transport = MockTransport()
    let client = RingSoundClient(transport: transport, commandTimeout: 1)
    try await client.connect()
    transport.onWrite = { request in
      let packet = try RingSoundProtocol.decodePacket(request)
      XCTAssertEqual(packet.command, AudioCommand.nextFrame.rawValue)
      XCTAssertEqual(packet.body.hexString, "000000000003000000080000")

      var response = BinaryWriter()
      response.writeUInt16(0)
      response.writeUInt32(3)
      response.writeUInt32(8)
      response.writeUInt32(1)
      response.writeUInt8(1)
      response.writeUInt8(0xaa)
      transport.push(
        RingSoundProtocol.encodePacket(
          command: AudioCommand.dataFrame.rawValue,
          body: response.data
        )
      )
    }

    let frame = try await client.readAudioFrame(fileIndex: 3, frameOffset: 8)

    XCTAssertEqual(frame.data, Data([0xaa]))
  }

  func testNusClientConformsToTransport() {
    func assertTransport<T: RingSoundTransport>(_: T.Type) {}
    assertTransport(NusClient.self)
  }
}
