import Foundation
import XCTest

@testable import RingSound

final class PacketCodecTests: XCTestCase {
  func testCRC16MatchesPythonAndStandardVector() {
    XCTAssertEqual(RingSoundProtocol.crc16(Data("123456789".utf8)), 0x29b1)
    XCTAssertEqual(RingSoundProtocol.crc16(Data([0x01, 0x02, 0x03])), 0xadad)
  }

  func testEncodePacketMatchesPythonVector() {
    let encoded = RingSoundProtocol.encodePacket(
      command: 0x0501,
      body: Data([0x01, 0x02, 0x03])
    )

    XCTAssertEqual(encoded.hexString, "3f0004050100000003adad010203")
  }

  func testDecodePacketReadsHeaderAndBody() throws {
    let encoded = Data(hex: "3f0004070200000003514a616263")!
    let packet = try RingSoundProtocol.decodePacket(encoded)

    XCTAssertEqual(packet.command, 0x0702)
    XCTAssertEqual(packet.version, 4)
    XCTAssertEqual(packet.bodyCRC, 0x514a)
    XCTAssertEqual(packet.body, Data("abc".utf8))
  }

  func testDecodePacketRejectsBadMagicVersionLengthAndCRC() {
    XCTAssertThrowsError(
      try RingSoundProtocol.decodePacket(Data(hex: "0000040101000000000000")!)
    )
    XCTAssertThrowsError(
      try RingSoundProtocol.decodePacket(Data(hex: "3f00050101000000000000")!)
    )
    XCTAssertThrowsError(
      try RingSoundProtocol.decodePacket(Data(hex: "3f00040101000000010000")!)
    )
    XCTAssertThrowsError(
      try RingSoundProtocol.decodePacket(Data(hex: "3f00040501000000030000010203")!)
    )
  }

  func testPacketStreamReassemblesFragmentsSkipsNoiseAndEmitsMultiplePackets() throws {
    let first = RingSoundProtocol.encodePacket(command: 0x0101)
    let second = RingSoundProtocol.encodePacket(command: 0x0701, body: Data([0, 0, 0, 9]))
    var stream = PacketStream()

    XCTAssertTrue(try stream.feed(Data([0xaa, 0xbb]) + first.prefix(5)).isEmpty)
    let packets = try stream.feed(first.dropFirst(5) + second)

    XCTAssertEqual(packets.map(\.command), [0x0101, 0x0701])
    XCTAssertEqual(packets[1].body, Data([0, 0, 0, 9]))
    XCTAssertEqual(stream.bufferedByteCount, 0)
  }

  func testBinaryReaderWriterRoundTripAndTruncation() throws {
    var writer = BinaryWriter()
    writer.writeUInt8(0xfe)
    writer.writeUInt16(0x1234)
    writer.writeInt16(-2)
    writer.writeUInt32(0x89ab_cdef)
    writer.writeStringUInt16("戒指")

    var reader = BinaryReader(writer.data)
    XCTAssertEqual(try reader.readUInt8(), 0xfe)
    XCTAssertEqual(try reader.readUInt16(), 0x1234)
    XCTAssertEqual(try reader.readInt16(), -2)
    XCTAssertEqual(try reader.readUInt32(), 0x89ab_cdef)
    XCTAssertEqual(try reader.readStringUInt16(), "戒指")
    XCTAssertEqual(reader.remaining, 0)
    XCTAssertThrowsError(try reader.readUInt8())
  }
}
