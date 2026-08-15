#!/usr/bin/env python3
"""Standalone board-side ring recorder for /home/talk2/record2.

Unlike hardware/talk2/record (one-shot, auto-named output into ring/input),
this entrypoint runs forever: connect once, then repeatedly wait for the
ring's recording trigger and overwrite a single fixed WAV path
(/home/talk2/record2/result.wav) every time a recording completes.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
TALK2_ROOT = ROOT.parent


def _load_ring_sdk() -> Any:
    candidates = [
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

DEFAULT_RING_ADDRESS = "E2:C5:D7:16:6E:EA"


@dataclass(slots=True)
class RecorderArgs:
    address: str | None
    output: Path
    timeout_s: float
    scan_timeout_s: float
    command_timeout_s: float
    auto_time_sync: bool


def parse_args() -> RecorderArgs:
    parser = argparse.ArgumentParser(
        description="Persistent ring recorder: waits forever, overwrites a fixed WAV"
    )
    parser.add_argument(
        "--address",
        default=DEFAULT_RING_ADDRESS,
        help=f"BLE address / peripheral UUID of the ring (default: {DEFAULT_RING_ADDRESS})",
    )
    parser.add_argument(
        "--output",
        default="result.wav",
        help="Fixed output WAV path, overwritten on every recording",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=None,
        help="How long to wait for one recording trigger (default: forever)",
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
    output = Path(ns.output)
    if not output.is_absolute():
        output = (ROOT / output).resolve()
    address = ns.address or DEFAULT_RING_ADDRESS
    return RecorderArgs(
        address=address,
        output=output,
        timeout_s=ns.timeout,
        scan_timeout_s=ns.scan_timeout,
        command_timeout_s=ns.command_timeout,
        auto_time_sync=ns.auto_time_sync,
    )


async def connect_ring(args: RecorderArgs) -> tuple[Any, str]:
    print("[record2] checking ring bluetooth connectivity...")
    address = args.address
    devices = await sdk.scan_rings(address=address, timeout_s=args.scan_timeout_s)
    if devices:
        device = devices[0]
        address = device.address
        label = device.name or device.address
        print(f"[record2] bluetooth ok: found {len(devices)} device(s), using {label}")
    else:
        # Already-connected rings stop advertising, so a fresh BLE scan can
        # come up empty even though the ring is reachable. Fall back to a
        # direct connect by address; RingSoundClient.connect() has its own
        # scan-then-direct-connect fallback for this case.
        if not address:
            raise RuntimeError(
                "没有扫描到 Ring Sound 设备，且未指定 --address；"
                "请确认戒指已开机，或用 --address 指定已知 MAC"
            )
        label = address
        print(f"[record2] scan found nothing (ring may already be connected); trying direct connect to {label}")
    ring = await sdk.connect_ring(
        address=address,
        command_timeout_s=args.command_timeout_s,
        auto_time_sync=args.auto_time_sync,
    )
    return ring, label


def _write_result_wav(output: Path, wav_bytes: bytes) -> None:
    tmp = output.with_suffix(output.suffix + ".tmp")
    tmp.write_bytes(wav_bytes)
    tmp.replace(output)


async def listen_forever(args: RecorderArgs) -> None:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    print(f"[record2] output: {args.output}")
    ring, label = await connect_ring(args)
    print(f"[record2] connected: {label}")
    try:
        while True:
            print("[record2] waiting for recording trigger...")
            file_index, raw_audio = await sdk.receive_auto_audio_file(
                ring,
                timeout_s=args.timeout_s,
            )
            print(f"[record2] recording received (file_index={file_index}), decoding...")
            wav_bytes = sdk.decode_audio_to_wav(raw_audio)
            _write_result_wav(args.output, wav_bytes)
            print(f"[record2] saved: {args.output}")
    finally:
        await ring.disconnect()


async def run(args: RecorderArgs) -> None:
    while True:
        try:
            await listen_forever(args)
        except sdk.RingSoundError as exc:
            print(f"[record2] connection lost, reconnecting: {exc}", file=sys.stderr)
            await asyncio.sleep(3)
        except KeyboardInterrupt:
            raise


def main() -> int:
    args = parse_args()
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        print("[record2] stopped by user")
        return 0
    except Exception as exc:
        print(f"[record2] error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
