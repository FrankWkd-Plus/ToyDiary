import Foundation

public enum RingSoundProtocol {
  public static func crc16(_ data: Data, initial: UInt16 = 0xffff) -> UInt16 {
    var crc = initial
    for byte in data {
      crc = (crc >> 8) | (crc << 8)
      crc ^= UInt16(byte)
      crc ^= (crc & 0xff) >> 4
      crc ^= (crc << 8) << 4
      crc ^= ((crc & 0xff) << 4) << 1
    }
    return crc
  }

  public static func encodePacket(command: UInt16, body: Data = Data()) -> Data {
    let bodyCRC = body.isEmpty ? 0 : crc16(body)
    var writer = BinaryWriter()
    writer.writeUInt8(RingSoundPacketConstants.magic)
    writer.writeUInt16(RingSoundPacketConstants.protocolVersion)
    writer.writeUInt16(command)
    writer.writeUInt32(UInt32(body.count))
    writer.writeUInt16(bodyCRC)
    writer.write(body)
    return writer.data
  }

  public static func peekBodyLength(_ data: Data) throws -> Int {
    guard data.count >= RingSoundPacketConstants.headerSize else {
      throw RingSoundError.protocolError("Not enough bytes to read packet header")
    }
    var reader = BinaryReader(data)
    _ = try reader.readUInt8()
    _ = try reader.readUInt16()
    _ = try reader.readUInt16()
    return Int(try reader.readUInt32())
  }

  public static func decodePacket(_ data: Data) throws -> Packet {
    guard data.count >= RingSoundPacketConstants.headerSize else {
      throw RingSoundError.protocolError("Packet too short: \(data.count) bytes")
    }

    var reader = BinaryReader(data)
    let magic = try reader.readUInt8()
    let version = try reader.readUInt16()
    let command = try reader.readUInt16()
    let bodyLength = Int(try reader.readUInt32())
    let bodyCRC = try reader.readUInt16()

    guard magic == RingSoundPacketConstants.magic else {
      throw RingSoundError.protocolError(
        String(format: "Invalid packet magic: 0x%02X", magic)
      )
    }
    guard version <= RingSoundPacketConstants.protocolVersion else {
      throw RingSoundError.protocolError("Unsupported protocol version: \(version)")
    }
    guard bodyLength <= RingSoundPacketConstants.maximumBodyLength else {
      throw RingSoundError.protocolError("Body too large: \(bodyLength) bytes")
    }
    guard reader.remaining >= bodyLength else {
      throw RingSoundError.protocolError(
        "Incomplete packet: need \(RingSoundPacketConstants.headerSize + bodyLength), got \(data.count)"
      )
    }

    let body = try reader.read(bodyLength)
    if !body.isEmpty {
      let actualCRC = crc16(body)
      guard actualCRC == bodyCRC else {
        throw RingSoundError.protocolError(
          String(
            format: "Body CRC mismatch: expected 0x%04X, got 0x%04X",
            bodyCRC,
            actualCRC
          )
        )
      }
    }

    return Packet(
      command: command,
      body: body,
      version: version,
      bodyCRC: bodyCRC
    )
  }
}

public struct PacketStream: Sendable {
  private var buffer: [UInt8] = []

  public init() {}

  public var bufferedByteCount: Int {
    buffer.count
  }

  public mutating func clear() {
    buffer.removeAll(keepingCapacity: true)
  }

  public mutating func feed(_ data: Data) throws -> [Packet] {
    buffer.append(contentsOf: data)
    var packets: [Packet] = []

    while true {
      guard !buffer.isEmpty else { return packets }

      guard let magicIndex = buffer.firstIndex(of: RingSoundPacketConstants.magic) else {
        buffer.removeAll(keepingCapacity: true)
        return packets
      }
      if magicIndex > 0 {
        buffer.removeFirst(magicIndex)
      }

      guard buffer.count >= RingSoundPacketConstants.headerSize else {
        return packets
      }

      let bodyLength =
        (Int(buffer[5]) << 24)
        | (Int(buffer[6]) << 16)
        | (Int(buffer[7]) << 8)
        | Int(buffer[8])
      guard bodyLength <= RingSoundPacketConstants.maximumBodyLength else {
        clear()
        throw RingSoundError.protocolError("Body too large: \(bodyLength) bytes")
      }

      let packetLength = RingSoundPacketConstants.headerSize + bodyLength
      guard buffer.count >= packetLength else { return packets }

      let bytes = Data(buffer.prefix(packetLength))
      buffer.removeFirst(packetLength)
      packets.append(try RingSoundProtocol.decodePacket(bytes))
    }
  }
}
