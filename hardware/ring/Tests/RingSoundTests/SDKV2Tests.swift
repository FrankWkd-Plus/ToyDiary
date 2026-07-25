import Foundation
import XCTest

@testable import RingSound

final class SDKV2Tests: XCTestCase {
  func testSDKVersionAndScanDefaultMatchUpstreamV2() {
    XCTAssertEqual(RingSoundSDK.version, "0.4.1")
    XCTAssertEqual(RingSoundDefaults.scanTimeout, 25)
  }

  func testNUSWritesAlwaysUseTwentyByteChunks() {
    let source = Data((0..<41).map(UInt8.init))

    let chunks = NUSWriteStrategy.chunks(source)

    XCTAssertEqual(RingSoundDefaults.nusWriteChunkSize, 20)
    XCTAssertEqual(chunks.map(\.count), [20, 20, 1])
    XCTAssertEqual(
      chunks.reduce(into: Data()) { result, chunk in
        result.append(chunk)
      },
      source
    )
  }

  func testNUSWriteStrategyHandlesEmptyPayload() {
    XCTAssertEqual(NUSWriteStrategy.chunks(Data()), [])
  }
}
