#!/usr/bin/env python3
"""talk2/play2 — 有线音箱/耳机播放 wav（板载 ALSA，不走蓝牙）。

用法:
  python3 wire_play.py
  python3 wire_play.py test.wav
  python3 wire_play.py --device plughw:CARD=RK809,DEV=0 --volume 40 test.wav
  python3 wire_play.py --list
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore


def eprint(*a: object) -> None:
    print(*a, file=sys.stderr)


def run(cmd: list[str], timeout: float | None = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def load_config(path: Path | None = None) -> dict[str, Any]:
    cfg_path = path or (ROOT / "config.yaml")
    defaults: dict[str, Any] = {
        "playback": {
            "device": "plughw:CARD=RK809,DEV=0",
            "volume": 50,
            "mixer_control": "auto",
            "resample": False,
            "sample_rate": 44100,
            "channels": 2,
        },
        "paths": {"default_wav": "test.wav"},
    }
    if yaml is None or not cfg_path.exists():
        if yaml is None:
            eprint("提示: 未安装 PyYAML，使用内置默认配置")
        return defaults
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    # shallow merge
    out = defaults
    out["playback"] = {**defaults["playback"], **(data.get("playback") or {})}
    out["paths"] = {**defaults["paths"], **(data.get("paths") or {})}
    out["_config_path"] = str(cfg_path)
    return out


def list_devices() -> None:
    if shutil.which("aplay"):
        r = run(["aplay", "-l"], timeout=10)
        print(r.stdout or r.stderr or "(no aplay -l)")
        print("--- PCM names (aplay -L, head) ---")
        r2 = run(["aplay", "-L"], timeout=10)
        lines = (r2.stdout or "").splitlines()
        for line in lines[:50]:
            print(line)
    else:
        eprint("未找到 aplay")


def wav_info(path: Path) -> str:
    try:
        with wave.open(str(path), "rb") as w:
            return (
                f"ch={w.getnchannels()} rate={w.getframerate()} "
                f"width={w.getsampwidth()} frames={w.getnframes()}"
            )
    except Exception as exc:
        return f"(unreadable: {exc})"


def find_mixer_control() -> str | None:
    if not shutil.which("amixer"):
        return None
    r = run(["amixer", "scontrols"], timeout=10)
    text = r.stdout or ""
    names = re.findall(r"Simple mixer control '([^']+)'", text)
    prefer = [
        "Master",
        "Playback",
        "DAC",
        "Headphone",
        "Speaker",
        "PCM",
        "Digital",
        "Line Out",
        "HP",
    ]
    lower_map = {n.lower(): n for n in names}
    for key in prefer:
        for ln, orig in lower_map.items():
            if key.lower() in ln:
                return orig
    return names[0] if names else None


def set_volume(level: int, control: str | None = "auto") -> None:
    if not shutil.which("amixer"):
        eprint("[vol] 无 amixer，跳过")
        return
    level = max(0, min(100, int(level)))
    name = control
    if not name or name == "auto":
        name = find_mixer_control()
    if not name:
        eprint("[vol] 未找到混音控件，跳过音量设置")
        eprint("      可手动: amixer scontrols")
        return
    r = run(["amixer", "sset", name, f"{level}%"], timeout=10)
    if r.returncode == 0:
        print(f"[vol] {name} = {level}%")
    else:
        # 再试 -c 0
        r2 = run(["amixer", "-c", "0", "sset", name, f"{level}%"], timeout=10)
        if r2.returncode == 0:
            print(f"[vol] card0 {name} = {level}%")
        else:
            eprint(f"[vol] 设置失败: {(r.stderr or r2.stderr or '')[-200:]}")


def prepare_wav(src: Path, rate: int, channels: int, cache: Path) -> Path:
    if not shutil.which("ffmpeg"):
        return src
    cache.mkdir(parents=True, exist_ok=True)
    out = cache / f"{src.stem}_{rate}_{channels}ch.wav"
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src),
        "-ac", str(channels),
        "-ar", str(rate),
        "-sample_fmt", "s16",
        str(out),
    ]
    print(f"[wav] 转换: rate={rate} ch={channels}")
    r = run(cmd, timeout=180)
    if r.returncode == 0 and out.exists() and out.stat().st_size > 1000:
        return out
    eprint(f"[wav] 转换失败，使用原文件: {(r.stderr or '')[-200:]}")
    return src


def resolve_wav(cfg: dict[str, Any], arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if p.exists():
            return p.resolve()
        for cand in (Path.cwd() / p, ROOT / p, ROOT.parent.parent / "pi" / p.name):
            if cand.exists():
                return cand.resolve()
        return p.resolve()
    rel = (cfg.get("paths") or {}).get("default_wav") or "test.wav"
    p = Path(rel)
    for cand in (ROOT / p, ROOT / "test.wav", ROOT.parent.parent / "pi" / "test.wav", Path.cwd() / p):
        if cand.exists():
            return cand.resolve()
    return (ROOT / p).resolve()


def play_wav(device: str, wav: Path) -> bool:
    if not shutil.which("aplay"):
        eprint("未找到 aplay，请: sudo apt install -y alsa-utils")
        return False
    cmd = ["aplay", "-D", device, str(wav)]
    print(f"[play] {' '.join(cmd)}")
    # 实时输出到终端（不用 capture），便于感知播放进度
    r = subprocess.run(cmd, timeout=600)
    if r.returncode == 0:
        print("[play] OK")
        return True
    eprint(f"[play] aplay 失败 rc={r.returncode}，尝试 plughw 回退…")
    # 回退 plughw RK809
    for fallback in (
        "plughw:CARD=RK809,DEV=0",
        "default:CARD=RK809",
        "sysdefault:CARD=RK809",
    ):
        if fallback == device:
            continue
        cmd2 = ["aplay", "-D", fallback, str(wav)]
        print(f"[play] fallback: {' '.join(cmd2)}")
        r2 = subprocess.run(cmd2, timeout=600)
        if r2.returncode == 0:
            print(f"[play] OK via {fallback}")
            return True
    return False


def play_file(
    wav: Path | str,
    *,
    device: str | None = None,
    volume: int | None = None,
    mixer_control: str = "auto",
    resample: bool = False,
    sample_rate: int = 44100,
    channels: int = 2,
    config_path: Path | str | None = None,
    playback: dict[str, Any] | None = None,
) -> bool:
    """供其它模块复用的播放入口（talk2/tts 等）。

    参数优先级：显式参数 > playback 字典 > play2/config.yaml 默认。
    """
    wav_path = Path(wav)
    if not wav_path.is_absolute():
        # 相对路径：优先 cwd，再 play2 目录
        for cand in (Path.cwd() / wav_path, ROOT / wav_path):
            if cand.exists():
                wav_path = cand.resolve()
                break
        else:
            wav_path = wav_path.resolve()

    if not wav_path.exists():
        eprint(f"文件不存在: {wav_path}")
        return False

    cfg = load_config(Path(config_path) if config_path else None)
    pb = {**(cfg.get("playback") or {}), **(playback or {})}

    dev = device if device is not None else str(pb.get("device") or "plughw:CARD=RK809,DEV=0")
    vol = volume if volume is not None else pb.get("volume")
    mix = mixer_control if mixer_control != "auto" else str(pb.get("mixer_control") or "auto")
    do_resample = bool(resample or pb.get("resample"))
    rate = int(sample_rate or pb.get("sample_rate") or 44100)
    ch = int(channels or pb.get("channels") or 2)

    print(f"[play2] file={wav_path} size={wav_path.stat().st_size} {wav_info(wav_path)}")
    print(f"[play2] device={dev}")

    if vol is not None:
        set_volume(int(vol), mix)

    play_path = wav_path
    # mp3 → wav
    if play_path.suffix.lower() == ".mp3":
        if shutil.which("ffmpeg"):
            tmp = ROOT / "cache" / f"{play_path.stem}_from_mp3.wav"
            tmp.parent.mkdir(parents=True, exist_ok=True)
            r = run(
                [
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(play_path),
                    "-ac", "2", "-ar", "44100", "-sample_fmt", "s16",
                    str(tmp),
                ],
                timeout=180,
            )
            if r.returncode == 0 and tmp.exists():
                play_path = tmp
                print(f"[play2] mp3→wav {tmp}")
            else:
                eprint("[play2] mp3 转换失败")
                return False
        else:
            eprint("[play2] 需要 ffmpeg 才能播 mp3")
            return False

    if do_resample:
        play_path = prepare_wav(play_path, rate, ch, ROOT / "cache")
        print(f"[play2] resampled {play_path} {wav_info(play_path)}")

    return play_wav(dev, play_path)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="有线 ALSA 播放 wav（talk2/play2）")
    p.add_argument("wav", nargs="?", help="wav 路径")
    p.add_argument("--config", type=Path, default=None)
    p.add_argument("--device", default=None, help="ALSA 设备名")
    p.add_argument("--volume", type=int, default=None, help="0-100")
    p.add_argument("--list", action="store_true", help="列出声卡")
    p.add_argument("--resample", action="store_true", help="强制 ffmpeg 重采样")
    args = p.parse_args(argv)

    if args.list:
        list_devices()
        return 0

    cfg = load_config(args.config)
    pb = cfg.setdefault("playback", {})
    if args.device:
        pb["device"] = args.device
    if args.volume is not None:
        pb["volume"] = args.volume
    if args.resample:
        pb["resample"] = True

    wav = resolve_wav(cfg, args.wav)
    if not wav.exists():
        eprint(f"文件不存在: {wav}")
        eprint("请把 test.wav 放到 play2 目录，或指定路径")
        return 2

    device = str(pb.get("device") or "plughw:CARD=RK809,DEV=0")
    print(f"[info] config={cfg.get('_config_path', ROOT / 'config.yaml')}")
    print(f"[info] file={wav} size={wav.stat().st_size}")
    print(f"[info] wav={wav_info(wav)}")
    print(f"[info] device={device}")

    vol = pb.get("volume")
    if vol is not None:
        set_volume(int(vol), str(pb.get("mixer_control") or "auto"))

    play_path = wav
    if pb.get("resample"):
        play_path = prepare_wav(
            wav,
            int(pb.get("sample_rate") or 44100),
            int(pb.get("channels") or 2),
            ROOT / "cache",
        )
        print(f"[info] play_path={play_path} {wav_info(play_path)}")

    ok = play_wav(device, play_path)
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n中断")
        raise SystemExit(130)
