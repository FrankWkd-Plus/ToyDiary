import CryptoKit
import Foundation
import XCTest

@testable import RingSound

final class AudioCodecTests: XCTestCase {
  func testPCMConfigNormalizationAndFormatting() {
    XCTAssertEqual(
      PCMConfig(sampleRate: 0, channels: 4, bitDepth: 24),
      PCMConfig(sampleRate: 1, channels: 2, bitDepth: 16))
    XCTAssertEqual(
      PCMConfig(sampleRate: 8_000, channels: 1, bitDepth: 8).description, "8000Hz / 1ch / 8bit")
  }

  func testWAVMatchesPythonVector() {
    let wav = AudioCodec.buildWAV(pcm: Data([1, 2, 3, 4]))

    XCTAssertEqual(
      wav.hexString,
      "524946462800000057415645666d74201000000001000100803e0000007d000002001000646174610400000001020304"
    )
    XCTAssertTrue(AudioCodec.isWAV(wav))
  }

  func testPacketizedSpeexUsesLittleEndianLengthsAndPadding() {
    let raw = Data([2, 0, 0xaa, 0xbb, 1, 0, 0xcc, 0, 0, 0xff])
    XCTAssertEqual(
      AudioCodec.parsePacketizedSpeex(raw),
      [Data([0xaa, 0xbb]), Data([0xcc])]
    )
    XCTAssertNil(AudioCodec.parsePacketizedSpeex(Data([3, 0, 0xaa])))
  }

  func testLegacyFramedBlocksAndRawPacketSplitting() {
    let first = Data([1, 0, 0xaa, 0])
    let second = Data([1, 0, 0xbb, 0])
    XCTAssertEqual(
      AudioCodec.parsePacketizedSpeex(
        first + second,
        allowFramedBlocks: true,
        framedBlockSize: 4
      ),
      [Data([0xaa]), Data([0xbb])]
    )
    XCTAssertEqual(
      AudioCodec.splitRawSpeexPackets(Data(repeating: 1, count: 40)),
      [Data(repeating: 1, count: 20), Data(repeating: 1, count: 20)]
    )
    XCTAssertNil(AudioCodec.splitRawSpeexPackets(Data(repeating: 1, count: 21)))
  }

  func testSpeexDefaultsMatchPython() {
    XCTAssertEqual(AudioCodec.speexMode(sampleRate: 8_000), 0)
    XCTAssertEqual(AudioCodec.speexMode(sampleRate: 16_000), 1)
    XCTAssertEqual(AudioCodec.speexMode(sampleRate: 48_000), 2)
    XCTAssertEqual(AudioCodec.frameSize(sampleRate: 8_000), 160)
    XCTAssertEqual(AudioCodec.frameSize(sampleRate: 16_000), 320)
    XCTAssertEqual(AudioCodec.frameSize(sampleRate: 48_000), 640)
    XCTAssertEqual(AudioCodec.bitsSize(quality: 3), 20)
    XCTAssertEqual(AudioCodec.bitsSize(quality: 9), 46)
    XCTAssertEqual(AudioCodec.bitsSize(quality: 99), 20)
  }

  func testOggSpeexMatchesPythonByteForByte() throws {
    let ogg = try AudioCodec.buildOggSpeex(
      packets: [Data([0xaa, 0xbb]), Data([0xcc])]
    )

    XCTAssertTrue(AudioCodec.isOggSpeex(ogg))
    XCTAssertEqual(ogg.count, 220)
    XCTAssertEqual(
      SHA256.hash(data: ogg).map { String(format: "%02x", $0) }.joined(),
      "7233fa97a3960e682198a233b523dc64370c6cca63cfff27a5d09f95d2a56276"
    )
  }

  func testNormalizeDecodedPCMRemovesPerPacketPadding() {
    let first = Data(repeating: 0x11, count: 640) + Data(repeating: 0, count: 640)
    let second = Data(repeating: 0x22, count: 640) + Data(repeating: 0, count: 640)
    let normalized = AudioCodec.normalizeDecodedPCM(first + second, packetCount: 2)

    XCTAssertEqual(
      normalized, Data(repeating: 0x11, count: 640) + Data(repeating: 0x22, count: 640))
  }

  func testInjectedSpeexDecoderBuildsPlayableWAV() throws {
    let decoder: SpeexDecoder = { _, options in
      SpeexDecodeResult(
        pcmData: Data([1, 2, 3, 4]),
        pcmConfig: options.pcmConfig,
        sourceType: "test-speex",
        sourceExtension: "spx",
        packetCount: 1
      )
    }

    let playable = try AudioCodec.buildPlayableAudio(
      data: Data([2, 0, 0xaa, 0xbb]),
      decoder: decoder
    )

    XCTAssertEqual(playable.playMode, "speex-decode")
    XCTAssertEqual(playable.sourceType, "test-speex")
    XCTAssertTrue(AudioCodec.isWAV(playable.data))
  }

  func testWAVInputIsReturnedWithoutDecoder() throws {
    let wav = AudioCodec.buildWAV(pcm: Data([1, 2]))
    let playable = try AudioCodec.buildPlayableAudio(data: wav)

    XCTAssertEqual(playable.data, wav)
    XCTAssertEqual(playable.playMode, "direct")
    XCTAssertEqual(playable.sourceType, "wav")
  }
}
