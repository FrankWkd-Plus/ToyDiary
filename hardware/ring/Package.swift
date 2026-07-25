// swift-tools-version: 5.9

import PackageDescription

let package = Package(
  name: "RingSound",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
  ],
  products: [
    .library(name: "RingSound", targets: ["RingSound"])
  ],
  targets: [
    .target(name: "RingSound"),
    .testTarget(name: "RingSoundTests", dependencies: ["RingSound"]),
  ]
)
