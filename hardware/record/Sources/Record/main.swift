import Foundation
import RingSound

struct RecorderConfig {
  let identifier: UUID?
  let outputDirectory: URL
  let timeout: TimeInterval
  let commandTimeout: TimeInterval
  let scanTimeout: TimeInterval
  let autoTimeSync: Bool
}

func defaultOutputDirectory() -> URL {
  URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("../ring/input", isDirectory: true)
    .standardizedFileURL
}

func parseArguments() -> RecorderConfig {
  let args = Array(CommandLine.arguments.dropFirst())
  var identifier: UUID?
  var outputDirectory = defaultOutputDirectory()
  var timeout: TimeInterval = 120
  var commandTimeout: TimeInterval = RingSoundDefaults.commandTimeout
  var scanTimeout: TimeInterval = RingSoundDefaults.scanTimeout
  var autoTimeSync = false

  var index = 0
  while index < args.count {
    let argument = args[index]
    switch argument {
    case "--identifier", "--uuid":
      index += 1
      guard index < args.count, let value = UUID(uuidString: args[index]) else {
        fputs("Missing or invalid UUID for --identifier\n", stderr)
        exit(2)
      }
      identifier = value
    case "--output", "--out":
      index += 1
      guard index < args.count else {
        fputs("Missing path for --output\n", stderr)
        exit(2)
      }
      outputDirectory = URL(fileURLWithPath: args[index], isDirectory: true)
    case "--timeout":
      index += 1
      guard index < args.count, let value = TimeInterval(args[index]) else {
        fputs("Missing numeric value for --timeout\n", stderr)
        exit(2)
      }
      timeout = value
    case "--command-timeout":
      index += 1
      guard index < args.count, let value = TimeInterval(args[index]) else {
        fputs("Missing numeric value for --command-timeout\n", stderr)
        exit(2)
      }
      commandTimeout = value
    case "--scan-timeout":
      index += 1
      guard index < args.count, let value = TimeInterval(args[index]) else {
        fputs("Missing numeric value for --scan-timeout\n", stderr)
        exit(2)
      }
      scanTimeout = value
    case "--auto-time-sync":
      autoTimeSync = true
    case "--help", "-h":
      printUsage()
      exit(0)
    default:
      fputs("Unknown argument: \(argument)\n", stderr)
      printUsage()
      exit(2)
    }
    index += 1
  }

  return RecorderConfig(
    identifier: identifier,
    outputDirectory: outputDirectory,
    timeout: timeout,
    commandTimeout: commandTimeout,
    scanTimeout: scanTimeout,
    autoTimeSync: autoTimeSync
  )
}

func printUsage() {
  print(
    """
    Ring recorder

    Usage:
      swift run Record [--identifier <uuid>] [--output <dir>] [--timeout <seconds>] [--command-timeout <seconds>] [--scan-timeout <seconds>] [--auto-time-sync]

    Defaults:
      --output ../ring/input
      --timeout 120
      --command-timeout 10
      --scan-timeout 25
    """
  )
}

func connectRing(config: RecorderConfig) async throws -> RingSoundClient {
  let devices = try await scanRings(identifier: config.identifier, timeout: config.scanTimeout)
  guard let device = devices.first else {
    throw RingSoundError.transport("No Ring Sound device found")
  }
  guard let identifier = UUID(uuidString: device.address) else {
    throw RingSoundError.transport("Invalid peripheral identifier: \(device.address)")
  }
  let ring = RingSoundClient(identifier: identifier, commandTimeout: config.commandTimeout)
  try await ring.connect()
  if config.autoTimeSync {
    _ = await ring.enableTimeSync()
  }
  return ring
}


func writeOutput(data: Data, fileIndex: UInt32, outputDirectory: URL) throws -> URL {
  try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
  let bundle = AudioCodec.saveAudioBundle(
    fileIndex: fileIndex,
    data: data,
    outputDirectory: outputDirectory
  )
  return bundle.playableURL
}

@main
struct RecordMain {
  static func main() async {
    let config = parseArguments()
    do {
      print("[record] waiting for ring...")
      let ring = try await connectRing(config: config)
      defer { Task { await ring.disconnect() } }
      print("[record] connected")
      print("[record] waiting for recording trigger")

      let recording = try await ring.receiveAutoAudioFile(timeout: config.timeout)
      let wavURL = try writeOutput(
        data: recording.data,
        fileIndex: recording.fileIndex,
        outputDirectory: config.outputDirectory
      )
      print("[record] saved \(wavURL.path)")
    } catch {
      fputs("[record] error: \(error)\n", stderr)
      exit(1)
    }
  }
}
