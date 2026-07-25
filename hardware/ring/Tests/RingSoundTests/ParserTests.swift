import Foundation
import XCTest

@testable import RingSound

final class ParserTests: XCTestCase {
  func testParseSystemInfoMatchesPythonVector() throws {
    let body = Data(
      hex: "0000000456322e300000007b000003e8000001900055010002534e0003435055000452696e67"
    )!

    let info = try RingSoundParsers.systemInfo(body)

    XCTAssertEqual(info.firmwareVersion, "V2.0")
    XCTAssertEqual(info.systemTime, 123)
    XCTAssertEqual(info.audioStorageTotal, 1_000)
    XCTAssertEqual(info.audioStorageAvailable, 400)
    XCTAssertEqual(info.batteryPercent, 85)
    XCTAssertTrue(info.batteryCharging)
    XCTAssertEqual(info.serialNumber, "SN")
    XCTAssertEqual(info.cpuID, "CPU")
    XCTAssertEqual(info.model, "Ring")
  }

  func testNonzeroDeviceErrorPreservesCodeAndMessage() {
    XCTAssertThrowsError(try RingSoundParsers.audioFileInfo(Data([0x00, 0x02]))) { error in
      guard case RingSoundError.device(let code, let message) = error else {
        return XCTFail("Unexpected error: \(error)")
      }
      XCTAssertEqual(code, 2)
      XCTAssertEqual(message, "device busy")
    }
  }

  func testParseAudioFileInfoRejectsTrailingBytes() throws {
    var body = BinaryWriter()
    body.writeUInt16(0)
    body.writeUInt32(7)
    body.writeUInt32(1_700_000_000)
    body.writeUInt32(1234)
    let info = try RingSoundParsers.audioFileInfo(body.data)
    XCTAssertEqual(info, AudioFileInfo(fileIndex: 7, recordTime: 1_700_000_000, dataSize: 1234))

    body.writeUInt8(0xff)
    XCTAssertThrowsError(try RingSoundParsers.audioFileInfo(body.data))
  }

  func testParseAudioFrameValidatesDeclaredSize() throws {
    var body = BinaryWriter()
    body.writeUInt16(0)
    body.writeUInt32(3)
    body.writeUInt32(8)
    body.writeUInt32(2)
    body.writeUInt8(1)
    body.write(Data([0xaa, 0xbb]))

    let frame = try RingSoundParsers.audioDataFrame(body.data)
    XCTAssertEqual(frame.fileIndex, 3)
    XCTAssertEqual(frame.frameOffset, 8)
    XCTAssertEqual(frame.frameSize, 2)
    XCTAssertTrue(frame.isEnd)
    XCTAssertEqual(frame.data, Data([0xaa, 0xbb]))

    XCTAssertThrowsError(try RingSoundParsers.audioDataFrame(body.data.dropLast()))
  }

  func testParseSensorBatchMatchesPythonVector() throws {
    let body = Data(
      hex: "00000000000700010010000004d2ffff0002fffd0004fffb0006"
    )!

    let batch = try RingSoundParsers.sensorDataBatch(body)

    XCTAssertEqual(batch.sequenceStart, 7)
    XCTAssertEqual(batch.frameCount, 1)
    XCTAssertEqual(batch.sampleSize, 16)
    XCTAssertEqual(
      batch.samples,
      [
        SensorDataSample(
          timestampMilliseconds: 1234,
          accelerationX: -1,
          accelerationY: 2,
          accelerationZ: -3,
          gyroscopeX: 4,
          gyroscopeY: -5,
          gyroscopeZ: 6
        )
      ]
    )
  }

  func testSensorBatchRejectsUnsupportedSampleSizeAndWrongLength() {
    var wrongSize = BinaryWriter()
    wrongSize.writeUInt16(0)
    wrongSize.writeUInt32(0)
    wrongSize.writeUInt16(0)
    wrongSize.writeUInt16(15)
    XCTAssertThrowsError(try RingSoundParsers.sensorDataBatch(wrongSize.data))

    var wrongLength = BinaryWriter()
    wrongLength.writeUInt16(0)
    wrongLength.writeUInt32(0)
    wrongLength.writeUInt16(1)
    wrongLength.writeUInt16(16)
    XCTAssertThrowsError(try RingSoundParsers.sensorDataBatch(wrongLength.data))
  }

  func testEventParsersAndGestureNames() throws {
    XCTAssertEqual(
      try RingSoundParsers.doubleTapEvent(Data([0, 0, 0, 9])),
      SensorDoubleTapEvent(timestampMilliseconds: 9)
    )
    XCTAssertEqual(
      try RingSoundParsers.gestureEvent(Data([0, 0, 0, 10, 3])),
      SensorGestureEvent(timestampMilliseconds: 10, gestureID: 3)
    )
    XCTAssertEqual(RingSoundParsers.gestureName(3), "wave")
    XCTAssertEqual(RingSoundParsers.gestureName(99), "unknown(99)")
    XCTAssertThrowsError(try RingSoundParsers.gestureEvent(Data([0, 0, 0, 10, 3, 0])))
  }
}
