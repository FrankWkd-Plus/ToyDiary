# Ring Sound SDK v2.0.0 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the repository from the v1.0.0 Swift distribution based on Python 0.3.4 to the v2.0.0 distribution based on the supplied Python 0.4.1 SDK.

**Architecture:** Preserve the existing Swift Package boundaries and v4 protocol implementation. Change only the upstream-defined transport behavior—25-second default discovery and fixed 20-byte NUS writes—then synchronize the canonical Python SDK, documentation, and newly supplied inner-ring STEP resources.

**Tech Stack:** Swift 5.9, Foundation, CoreBluetooth, XCTest, Python 3, Swift Package Manager, GitHub Releases.

---

## Audited upstream delta

- `ring_sound.py`: `0.3.4` to `0.4.1`.
- Default BLE scan timeout: `8.0` to `25.0` seconds.
- NUS writes: remove caller-selected/dynamic chunk sizing and always split into 20-byte chunks.
- Protocol commands and packet bodies: unchanged.
- `demo.apk`: unchanged SHA-256 (`3952650e9b339746d30c7d23b9f65790baeb69a69460649564feeb78b21d10ff`).
- Existing eight outer/button STEP files: unchanged.
- New resources: `戒指打印模型/内环STEP/{7,9,10,11}内环.STEP`.

### Task 1: Define v2 Swift behavior with failing tests

**Files:**
- Create: `Tests/RingSoundTests/SDKV2Tests.swift`

- [x] **Step 1: Add version and transport-default tests**

```swift
func testSDKVersionAndScanDefaultMatchUpstreamV2() {
  XCTAssertEqual(RingSoundSDK.version, "0.4.1")
  XCTAssertEqual(RingSoundDefaults.scanTimeout, 25)
}
```

- [x] **Step 2: Add the fixed-size chunking test**

```swift
func testNUSWritesAlwaysUseTwentyByteChunks() {
  let source = Data((0..<41).map(UInt8.init))
  let chunks = NUSWriteStrategy.chunks(source)
  XCTAssertEqual(RingSoundDefaults.nusWriteChunkSize, 20)
  XCTAssertEqual(chunks.map(\.count), [20, 20, 1])
  XCTAssertEqual(chunks.reduce(into: Data(), { $0.append($1) }), source)
}
```

- [x] **Step 3: Run tests and verify RED**

Run:

```bash
swift test --filter SDKV2Tests
```

Expected: compilation fails because `nusWriteChunkSize` and `NUSWriteStrategy` do not exist and the old version/default assertions do not match.

### Task 2: Implement fixed 20-byte NUS writes

**Files:**
- Modify: `Sources/RingSound/RingSoundConstants.swift`
- Modify: `Sources/RingSound/NusClient.swift`
- Modify: `Sources/RingSound/RingSoundClient.swift`

- [x] **Step 1: Update version and defaults**

```swift
public enum RingSoundSDK {
  public static let version = "0.4.1"
}

public enum RingSoundDefaults {
  public static let scanTimeout: TimeInterval = 25
  public static let nusWriteChunkSize = 20
}
```

- [x] **Step 2: Add the tested internal chunk strategy**

```swift
enum NUSWriteStrategy {
  static func chunks(_ data: Data) -> [Data] {
    stride(from: 0, to: data.count, by: RingSoundDefaults.nusWriteChunkSize)
      .map { Data(data[$0..<min(data.count, $0 + RingSoundDefaults.nusWriteChunkSize)]) }
  }
}
```

- [x] **Step 3: Remove `writeChunkSize` from Swift initializers**

`NusClient.init` and `RingSoundClient.init(identifier:...)` must no longer expose `writeChunkSize`. `NusClient.enqueueWrite` must use `NUSWriteStrategy.chunks(_:)` for both CoreBluetooth write types.

- [x] **Step 4: Run tests and verify GREEN**

Run:

```bash
swift test
```

Expected: all existing and v2 tests pass.

### Task 3: Replace the upstream Python SDK and resources

**Files:**
- Replace: `ring_sound.py`
- Create: `戒指打印模型/内环STEP/7内环.STEP`
- Create: `戒指打印模型/内环STEP/9内环.STEP`
- Create: `戒指打印模型/内环STEP/10内环.STEP`
- Create: `戒指打印模型/内环STEP/11内环.STEP`
- Create: `.gitignore`

- [x] **Step 1: Copy the audited Python 0.4.1 file**

Copy the exact archive member `ring_sound_SDK/ring_sound.py` over the repository root `ring_sound.py`.

- [x] **Step 2: Copy only new model resources**

Copy the four files from archive directory `ring_sound_SDK/戒指打印模型/内环STEP/`; do not rewrite the byte-identical APK or existing STEP files.

- [x] **Step 3: Ignore generated build caches**

```gitignore
.build/
.swiftpm/
.DS_Store
__pycache__/
*.py[cod]
```

- [x] **Step 4: Verify the Python source**

Run:

```bash
python3 -m py_compile ring_sound.py
python3 -c 'import ring_sound; assert ring_sound.__version__ == "0.4.1"'
```

Expected: both commands exit successfully.

### Task 4: Merge upstream docs with Swift distribution docs

**Files:**
- Modify: `README.md`
- Replace then adapt: `protocol.md`
- Replace then adapt: `ring_sound_use.md`
- Modify: `ring_sound_swift_use.md`
- Modify: `attention.md`

- [x] **Step 1: Merge the upstream Python documentation changes**

Apply the audited changes:

- version `0.4.1`;
- default scan timeout `25.0`;
- fixed 20-byte RX writes;
- removal of Python `write_chunk_size`;
- 0.3.x migration guidance.

- [x] **Step 2: Preserve and update Swift-specific README content**

Keep the repository title and Swift Package navigation. State that GitHub distribution `v2.0.0` tracks Python SDK `0.4.1`, while protocol version remains v4.

- [x] **Step 3: Document the complete mechanical resource set**

Update the model table to 12 STEP files totaling 637,733 bytes, with columns for outer/shell, button, and inner ring.

- [x] **Step 4: Update Swift usage examples**

Use:

```swift
let devices = try await scanRings(timeout: 25)
let ring = RingSoundClient(identifier: identifier)
```

Explain that Swift v2 removes `writeChunkSize`, always writes 20-byte NUS chunks, and still accepts arbitrary incoming notification sizes through `PacketStream`.

### Task 5: Full validation and publication

**Files:**
- Modify: all files above

- [x] **Step 1: Validate source and docs**

Run:

```bash
swift format format --in-place --recursive Sources Tests Package.swift
swift test
swift build -c release
python3 -m py_compile ring_sound.py
git diff --check
```

Expected: all commands succeed and all Swift tests pass.

- [x] **Step 2: Validate iOS compilation**

Run:

```bash
swift build \
  --triple arm64-apple-ios15.0 \
  --sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS26.5.sdk
```

Expected: the RingSound target compiles for iOS.

- [ ] **Step 3: Commit implementation and documentation**

```bash
git add Package.swift Sources Tests ring_sound.py 戒指打印模型 .gitignore
git commit -m "feat: migrate ring SDK to v2.0.0"
git add README.md protocol.md ring_sound_use.md ring_sound_swift_use.md attention.md docs
git commit -m "docs: update v2.0.0 SDK guides"
```

- [ ] **Step 4: Push the requested feature branch**

```bash
git push -u origin feat/v2.0.0
```

- [ ] **Step 5: Open a draft pull request**

Create a draft pull request from `feat/v2.0.0` to `main` summarizing the upstream 0.4.1 delta, compatibility impact, new resources, and validation results.
