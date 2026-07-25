#!/usr/bin/env python3
"""Standalone board-side ring recorder for /home/talk2/record.

This entrypoint is intentionally independent from hardware/talk. It loads the
Ring Sound Python SDK directly, waits for the recording trigger, and exports a
WAV into hardware/ring/input for STT.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
TALK2_ROOT = ROOT.parent.parent / "talk2"


def _load_ring_sdk() -> Any:
    candidates = [
        ROOT.parent / "ring_sound.py",
        ROOT.parent / "ring" / "ring_sound.py",
        ROOT.parent.parent / "ring_sound.py",
        ROOT.parent.parent / "ring" / "ring_sound.py",
        TALK2_ROOT / "ring_sound.py",
        TALK2_ROOT / "ring" / "ring_sound.py",
    ]
    for path in candidates:
        if path.exists():
            parent = str(path.parent)
            if parent not in sys.path:
                sys.path.insert(0, parent)
            import ring_sound as sdk  # type: ignore

            return sdk
    raise SystemExit(
        "找不到 ring_sound.py。请把 hardware/ring/ring_sound.py 同步到板子，"
        "并放到 /home/talk2/ring_sound.py 或 /home/talk2/ring/ring_sound.py。"
    )


sdk = _load_ring_sdk()


@dataclass(slots=True)
class RecorderArgs:
    address: str | None
    output_dir: Path
    timeout_s: float
    scan_timeout_s: float
    command_timeout_s: float
    auto_time_sync: bool


def parse_args() -> RecorderArgs:
    parser = argparse.ArgumentParser(description="Standalone ring recorder")
    parser.add_argument(
        "--address",
        default=None,
        help="BLE address / peripheral UUID of the ring",
    )
    parser.add_argument(
        "--output",
        default="../ring/input",
        help="Output directory for STT-ready WAV files",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="How long to wait for the recording trigger",
    )
    parser.add_argument(
        "--scan-timeout",
        type=float,
        default=25.0,
        help="How long to scan for the ring before connecting",
    )
    parser.add_argument(
        "--command-timeout",
        type=float,
        default=10.0,
        help="Per-command timeout when talking to the ring",
    )
    parser.add_argument(
        "--auto-time-sync",
        action="store_true",
        help="Auto-respond to time sync requests from the ring",
    )
    ns = parser.parse_args()
    output_dir = Path(ns.output)
    if not output_dir.is_absolute():
        output_dir = (TALK2_ROOT / output_dir).resolve()
    else:
        output_dir = output_dir.resolve()
    return RecorderArgs(
        address=ns.address,
        output_dir=output_dir,
        timeout_s=ns.timeout,
        scan_timeout_s=ns.scan_timeout,
        command_timeout_s=ns.command_timeout,
        auto_time_sync=ns.auto_time_sync,
    )


async def connect_ring(args: RecorderArgs) -> Any:
    devices = await sdk.scan_rings(address=args.address, timeout_s=args.scan_timeout_s)
    if not devices:
        raise RuntimeError("没有扫描到 Ring Sound 设备")
    device = devices[0]
    ring = await sdk.connect_ring(
        address=device.address,
        command_timeout_s=args.command_timeout_s,
        auto_time_sync=args.auto_time_sync,
    )
    return ring


async def wait_and_save(args: RecorderArgs) -> Path:
    args.output_dir.mkdir(parents=True, exist_ok=True)
    print(f"[record] output: {args.output_dir}")
    ring = await connect_ring(args)
    try:
        print(f"[record] connected: {args.address or 'auto'}")
        print("[record] waiting for recording trigger...")
        file_index, raw_audio = await sdk.receive_auto_audio_file(
            ring,
            timeout_s=args.timeout_s,
        )
        bundle = sdk.save_audio_bundle(
            file_index=file_index,
            data=raw_audio,
            output_dir=args.output_dir,
        )
        print(f"[record] raw: {bundle.raw_path}")
        print(f"[record] wav: {bundle.play_path}")
        return Path(bundle.play_path)
    finally:
        await ring.disconnect()


def main() -> int:
    args = parse_args()
    try:
        asyncio.run(wait_and_save(args))
    except Exception as exc:
        print(f"[record] error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
