import Foundation

public struct BinaryReader: Sendable {
  private let bytes: [UInt8]
  public private(set) var offset = 0

  public init(_ data: Data) {
    bytes = Array(data)
  }

  public var remaining: Int {
    bytes.count - offset
  }

  private func require(_ count: Int) throws {
    guard count >= 0, remaining >= count else {
      throw RingSoundError.protocolError(
        "Need \(count) bytes, only \(remaining) left"
      )
    }
  }

  public mutating func readUInt8() throws -> UInt8 {
    try require(1)
    defer { offset += 1 }
    return bytes[offset]
  }

  public mutating func readUInt16() throws -> UInt16 {
    try require(2)
    let value = (UInt16(bytes[offset]) << 8) | UInt16(bytes[offset + 1])
    offset += 2
    return value
  }

  public mutating func readInt16() throws -> Int16 {
    Int16(bitPattern: try readUInt16())
  }

  public mutating func readUInt32() throws -> UInt32 {
    try require(4)
    let value =
      (UInt32(bytes[offset]) << 24)
      | (UInt32(bytes[offset + 1]) << 16)
      | (UInt32(bytes[offset + 2]) << 8)
      | UInt32(bytes[offset + 3])
    offset += 4
    return value
  }

  public mutating func read(_ count: Int) throws -> Data {
    try require(count)
    let value = Data(bytes[offset..<(offset + count)])
    offset += count
    return value
  }

  public mutating func readStringUInt16() throws -> String {
    let count = Int(try readUInt16())
    let data = try read(count)
    return String(decoding: data, as: UTF8.self)
  }
}

public struct BinaryWriter: Sendable {
  public private(set) var data = Data()

  public init() {}

  public mutating func writeUInt8(_ value: UInt8) {
    data.append(value)
  }

  public mutating func writeUInt16(_ value: UInt16) {
    data.append(UInt8(truncatingIfNeeded: value >> 8))
    data.append(UInt8(truncatingIfNeeded: value))
  }

  public mutating func writeInt16(_ value: Int16) {
    writeUInt16(UInt16(bitPattern: value))
  }

  public mutating func writeUInt32(_ value: UInt32) {
    data.append(UInt8(truncatingIfNeeded: value >> 24))
    data.append(UInt8(truncatingIfNeeded: value >> 16))
    data.append(UInt8(truncatingIfNeeded: value >> 8))
    data.append(UInt8(truncatingIfNeeded: value))
  }

  public mutating func write(_ value: Data) {
    data.append(value)
  }

  public mutating func writeStringUInt16(_ value: String) {
    let encoded = Data(value.utf8)
    precondition(encoded.count <= Int(UInt16.max), "String is too long for a UInt16 length")
    writeUInt16(UInt16(encoded.count))
    write(encoded)
  }

  public mutating func writeStringUInt32(_ value: String) {
    let encoded = Data(value.utf8)
    precondition(encoded.count <= Int(UInt32.max), "String is too long for a UInt32 length")
    writeUInt32(UInt32(encoded.count))
    write(encoded)
  }
}
