#!/usr/bin/env python3
"""talk2 蓝牙 A2DP 播放模块。

目标：在 Orange Pi 上把 wav 稳定播放到已配对蓝牙音箱（bluealsa）。

用法（在 play 目录或任意处）:
  python3 bt_play.py
  python3 bt_play.py /path/to/file.wav
  python3 bt_play.py --mac 52:5E:48:6A:8D:26 --volume 35 test.wav
  python3 bt_play.py --no-resample test.wav

依赖: bluez, bluealsa, bluealsa-utils, alsa-utils (aplay), ffmpeg(可选但推荐)
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
import wave
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore


def eprint(*a: object) -> None:
    print(*a, file=sys.stderr)


def load_config(path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or ROOT / "config.yaml"
    if yaml is None:
        eprint("警告: 未安装 PyYAML，使用内置默认配置。 pip install pyyaml")
        return {
            "bluetooth": {"mac": "52:5E:48:6A:8D:26", "profile": "a2dp", "auto_connect": True},
            "playback": {"volume": 40, "sample_rate": 48000, "channels": 2, "prefer": "aplay"},
            "paths": {"default_wav": str(ROOT / "test.wav")},
        }
    if not cfg_path.exists():
        eprint(f"配置不存在: {cfg_path}，使用默认")
        return load_config.__wrapped__ if False else {  # type: ignore
            "bluetooth": {"mac": "52:5E:48:6A:8D:26", "profile": "a2dp", "auto_connect": True},
            "playback": {"volume": 40, "sample_rate": 48000, "channels": 2, "prefer": "aplay"},
            "paths": {"default_wav": "../../pi/test.wav"},
        }
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    data["_config_path"] = str(cfg_path)
    return data


def run(cmd: list[str], timeout: float | None = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def which(name: str) -> str | None:
    return shutil.which(name)


def normalize_mac(mac: str) -> str:
    mac = mac.strip().upper().replace("-", ":")
    if not re.fullmatch(r"([0-9A-F]{2}:){5}[0-9A-F]{2}", mac):
        raise ValueError(f"无效 MAC: {mac}")
    return mac


def bt_pcm_device(mac: str, profile: str = "a2dp") -> str:
    return f"bluealsa:DEV={mac},PROFILE={profile}"


def pcm_dbus_path(mac: str) -> str:
    dev = mac.replace(":", "_")
    return f"/org/bluealsa/hci0/dev_{dev}/a2dpsrc/sink"


def ensure_connected(mac: str, timeout_s: float = 20) -> bool:
    if not which("bluetoothctl"):
        eprint("未找到 bluetoothctl")
        return False
    info = run(["bluetoothctl", "info", mac], timeout=15)
    text = (info.stdout or "") + (info.stderr or "")
    if re.search(r"Connected:\s*yes", text, re.I):
        print(f"[bt] 已连接 {mac}")
        return True
    print(f"[bt] 连接 {mac} …")
    run(["bluetoothctl", "power", "on"], timeout=10)
    run(["bluetoothctl", "connect", mac], timeout=timeout_s)
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        info = run(["bluetoothctl", "info", mac], timeout=10)
        text = (info.stdout or "") + (info.stderr or "")
        if re.search(r"Connected:\s*yes", text, re.I):
            print(f"[bt] 连接成功 {mac}")
            time.sleep(0.4)
            return True
        time.sleep(0.5)
    eprint(f"[bt] 连接超时: {mac}")
    return False


def set_volume(mac: str, volume_0_100: int) -> None:
    vol = max(0, min(100, int(volume_0_100)))
    ba = int(round(vol * 127 / 100))
    pcm = pcm_dbus_path(mac)
    if which("bluealsa-cli"):
        r = run(["bluealsa-cli", "volume", pcm, str(ba), str(ba)], timeout=10)
        if r.returncode != 0:
            r = run(["bluealsa-cli", "volume", pcm, str(ba)], timeout=10)
        if r.returncode == 0:
            print(f"[bt] volume={vol}% ({ba}/127)")
            return
        eprint(f"[bt] bluealsa-cli volume 失败: {(r.stderr or r.stdout or '')[-200:]}")
    if which("amixer"):
        r = run(["amixer", "-D", "bluealsa", "scontrols"], timeout=10)
        names = re.findall(r"Simple mixer control '([^']+)'", (r.stdout or ""))
        for n in names:
            if "A2DP" in n.upper():
                r2 = run(["amixer", "-D", "bluealsa", "sset", n, f"{vol}%"], timeout=10)
                if r2.returncode == 0:
                    print(f"[bt] amixer volume={vol}% ({n})")
                    return


def wav_info(path: Path) -> tuple[int, int, int] | None:
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnchannels(), w.getframerate(), w.getsampwidth()
    except Exception:
        return None


def prepare_wav(
    src: Path,
    *,
    sample_rate: int,
    channels: int,
    cache_dir: Path,
) -> Path:
    """转成 A2DP 友好格式；失败则返回原文件。"""
    info = wav_info(src)
    if info and info[0] == channels and info[1] == sample_rate and info[2] == 2:
        print(f"[wav] 已是目标格式 ch={channels} rate={sample_rate}: {src}")
        return src
    if not which("ffmpeg"):
        eprint("[wav] 无 ffmpeg，使用原始文件")
        return src
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = cache_dir / f"{src.stem}_{sample_rate}_{channels}ch.wav"
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-ac", str(channels),
        "-ar", str(sample_rate),
        "-sample_fmt", "s16",
        str(out),
    ]
    print(f"[wav] 转换: {' '.join(cmd)}")
    r = run(cmd, timeout=180)
    if r.returncode == 0 and out.exists() and out.stat().st_size > 1000:
        print(f"[wav] 输出 {out} ({out.stat().st_size} bytes) info={wav_info(out)}")
        return out
    eprint(f"[wav] 转换失败: {(r.stderr or r.stdout or '')[-300:]}")
    return src


def play_aplay(device: str, wav: Path, buffer_time_us: int = 0, period_time_us: int = 0) -> bool:
    if not which("aplay"):
        eprint("未找到 aplay")
        return False
    cmd = ["aplay", "-D", device]
    if buffer_time_us > 0:
        cmd.append(f"--buffer-time={buffer_time_us}")
    if period_time_us > 0:
        cmd.append(f"--period-time={period_time_us}")
    cmd.append(str(wav))
    print(f"[play] {' '.join(cmd)}")
    # 不 capture，便于看实时进度；但为了日志完整还是 capture
    r = run(cmd, timeout=600)
    if r.returncode == 0:
        print("[play] aplay OK")
        return True
    eprint(f"[play] aplay 失败 rc={r.returncode}: {(r.stderr or r.stdout or '')[-400:]}")
    return False


def play_ffmpeg_alsa(device: str, wav: Path) -> bool:
    if not which("ffmpeg"):
        return False
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", str(wav),
        "-f", "alsa",
        device,
    ]
    print(f"[play] {' '.join(cmd)}")
    r = run(cmd, timeout=600)
    if r.returncode == 0:
        print("[play] ffmpeg/alsa OK")
        return True
    eprint(f"[play] ffmpeg 失败: {(r.stderr or r.stdout or '')[-400:]}")
    return False


def resolve_wav(cfg: dict[str, Any], arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if not p.is_absolute():
            # 相对 cwd，再相对 play/
            for cand in (Path.cwd() / p, ROOT / p, ROOT.parent.parent / "pi" / p.name):
                if cand.exists():
                    return cand.resolve()
        return p.resolve()
    rel = (cfg.get("paths") or {}).get("default_wav") or "test.wav"
    p = Path(rel)
    if not p.is_absolute():
        for cand in (ROOT / p, ROOT / "test.wav", ROOT.parent.parent / "pi" / "test.wav"):
            if cand.exists():
                return cand.resolve()
    return (ROOT / p).resolve()


def play_file(cfg: dict[str, Any], wav_path: Path) -> int:
    bt = cfg.get("bluetooth") or {}
    pb = cfg.get("playback") or {}
    mac = normalize_mac(str(bt.get("mac") or "52:5E:48:6A:8D:26"))
    profile = str(bt.get("profile") or "a2dp")
    auto_connect = bool(bt.get("auto_connect", True))

    if not wav_path.exists():
        eprint(f"文件不存在: {wav_path}")
        return 2

    print(f"[play] file={wav_path} size={wav_path.stat().st_size}")
    print(f"[play] info={wav_info(wav_path)}")
    print(f"[play] target mac={mac}")

    if auto_connect:
        if not ensure_connected(mac, float(bt.get("connect_timeout_s") or 20)):
            return 3

    vol = pb.get("volume", None)
    if vol is not None:
        try:
            set_volume(mac, int(vol))
        except Exception as exc:
            eprint(f"[bt] set volume: {exc}")

    rate = int(pb.get("sample_rate") or 48000)
    ch = int(pb.get("channels") or 2)
    cache = pb.get("cache_dir") or "cache"
    cache_dir = Path(cache) if Path(cache).is_absolute() else (ROOT / cache)

    no_resample = bool(pb.get("_no_resample"))
    play_wav = wav_path if no_resample else prepare_wav(
        wav_path, sample_rate=rate, channels=ch, cache_dir=cache_dir
    )

    device = bt_pcm_device(mac, profile)
    prefer = str(pb.get("prefer") or "aplay").lower()
    buf = int(pb.get("aplay_buffer_time_us") or 0)
    per = int(pb.get("aplay_period_time_us") or 0)

    ok = False
    if prefer == "ffmpeg":
        ok = play_ffmpeg_alsa(device, play_wav) or play_aplay(device, play_wav, buf, per)
        if not ok:
            ok = play_aplay(f"plug:{device}", play_wav, buf, per)
    else:
        # aplay 优先；失败再 ffmpeg
        ok = play_aplay(device, play_wav, buf, per)
        if not ok:
            ok = play_aplay(f"plug:{device}", play_wav, 0, 0)
        if not ok:
            ok = play_ffmpeg_alsa(device, play_wav)

    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="talk2 蓝牙音箱播放 wav")
    p.add_argument("wav", nargs="?", help="wav 路径（默认 config paths.default_wav）")
    p.add_argument("--config", type=Path, default=None, help="config.yaml")
    p.add_argument("--mac", default=None, help="覆盖蓝牙 MAC")
    p.add_argument("--volume", type=int, default=None, help="音量 0-100")
    p.add_argument("--no-resample", action="store_true", help="不转换采样率")
    p.add_argument("--prefer", choices=["aplay", "ffmpeg"], default=None)
    args = p.parse_args(argv)

    cfg = load_config(args.config)
    if args.mac:
        cfg.setdefault("bluetooth", {})["mac"] = args.mac
    if args.volume is not None:
        cfg.setdefault("playback", {})["volume"] = args.volume
    if args.prefer:
        cfg.setdefault("playback", {})["prefer"] = args.prefer
    if args.no_resample:
        cfg.setdefault("playback", {})["_no_resample"] = True

    wav = resolve_wav(cfg, args.wav)
    return play_file(cfg, wav)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n中断")
        raise SystemExit(130)
