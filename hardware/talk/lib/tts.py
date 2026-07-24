"""语音合成 TTS — Piper / espeak-ng，并播放到蓝牙音箱（bluealsa）。"""

from __future__ import annotations

import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from .config import get_active_voice, work_path


def _run(cmd: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def _bt_mac_from_cfg(cfg: dict[str, Any]) -> str | None:
    tts = cfg.get("tts") or {}
    mac = (tts.get("bluetooth_mac") or tts.get("bt_mac") or "").strip()
    if mac:
        return mac.upper().replace("-", ":")
    # 回退：读蓝牙持久化配置里的耳机（audio-headset / 名称含 MINISO）
    try:
        import json

        p = Path("/etc/toydairy-bluetooth/devices.json")
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            for d in data.get("devices") or []:
                name = str(d.get("name") or "")
                m = str(d.get("mac") or "")
                if not m:
                    continue
                if "MINISO" in name.upper() or "A127" in name.upper() or d.get("note") == "speaker":
                    return m.upper()
            # 非 ring 的第一台
            for d in data.get("devices") or []:
                name = str(d.get("name") or "").lower()
                m = str(d.get("mac") or "")
                if m and "ring" not in name:
                    return m.upper()
    except Exception:
        pass
    return None


def _list_bluealsa_pcms() -> list[str]:
    if not shutil.which("bluealsa-aplay"):
        return []
    r = _run(["bluealsa-aplay", "-L"])
    text = (r.stdout or "") + (r.stderr or "")
    # bluealsa:DEV=AA:BB:...,PROFILE=a2dp,SRV=org.bluealsa
    return re.findall(r"bluealsa:DEV=[0-9A-Fa-f:]{17}[^\\s]*", text)


def _bluealsa_device(cfg: dict[str, Any]) -> str | None:
    """返回 aplay -D 可用的 bluealsa PCM 名。"""
    tts = cfg.get("tts") or {}
    forced = (tts.get("alsa_device") or "").strip()
    if forced and forced != "auto":
        return forced

    pcms = _list_bluealsa_pcms()
    mac = _bt_mac_from_cfg(cfg)
    if mac:
        for p in pcms:
            if mac.upper() in p.upper():
                # 只要 DEV=MAC,PROFILE=a2dp
                m = re.search(r"(bluealsa:DEV=[0-9A-Fa-f:]{17},PROFILE=a2dp)", p, re.I)
                if m:
                    return m.group(1)
                return f"bluealsa:DEV={mac},PROFILE=a2dp"
        # 列表暂时为空但已知 MAC
        return f"bluealsa:DEV={mac},PROFILE=a2dp"
    if pcms:
        m = re.search(r"(bluealsa:DEV=[0-9A-Fa-f:]{17},PROFILE=a2dp)", pcms[0], re.I)
        if m:
            return m.group(1)
    return None


def _ensure_bt_connected(mac: str) -> None:
    if not shutil.which("bluetoothctl"):
        return
    info = _run(["bluetoothctl", "info", mac])
    text = (info.stdout or "") + (info.stderr or "")
    if re.search(r"Connected:\s*yes", text, re.I):
        return
    _run(["bluetoothctl", "connect", mac], timeout=30)


def _resample_for_a2dp(wav: Path, out: Path) -> Path:
    """A2DP 常见 48k stereo；转换失败则返回原文件。"""
    if not shutil.which("ffmpeg"):
        return wav
    out.parent.mkdir(parents=True, exist_ok=True)
    r = _run(
        [
            "ffmpeg", "-y", "-i", str(wav),
            "-ac", "2", "-ar", "48000", "-sample_fmt", "s16",
            str(out),
        ]
    )
    if r.returncode == 0 and out.exists() and out.stat().st_size > 44:
        return out
    return wav


def _play(cfg: dict[str, Any], wav: Path) -> None:
    tts = cfg.get("tts") or {}
    player = str(tts.get("player") or "auto").lower()
    verbose = bool((cfg.get("pipeline") or {}).get("verbose", True))

    # 1) 蓝牙 A2DP（优先）
    if player in ("auto", "bluealsa", "bt", "bluetooth"):
        dev = _bluealsa_device(cfg)
        mac = _bt_mac_from_cfg(cfg)
        if mac:
            _ensure_bt_connected(mac)
            time.sleep(0.3)
            # 刷新 pcm 列表
            dev = _bluealsa_device(cfg) or dev
        if dev and shutil.which("aplay"):
            play_wav = _resample_for_a2dp(
                wav, work_path(cfg, "audio", "tts", "_play_a2dp.wav")
            )
            if verbose:
                print(f"[tts] 播放到蓝牙: aplay -D {dev}")
            r = _run(["aplay", "-D", dev, str(play_wav)], timeout=120)
            if r.returncode == 0:
                return
            if verbose:
                err = ((r.stderr or r.stdout or "")[-300:]).strip()
                print(f"[tts] bluealsa 播放失败: {err}")

    # 2) 默认 aplay（板载）
    if player in ("auto", "aplay") and shutil.which("aplay"):
        if verbose:
            print("[tts] 回退板载 aplay")
        _run(["aplay", "-q", str(wav)], timeout=120)
        return

    if player == "paplay" and shutil.which("paplay"):
        _run(["paplay", str(wav)], timeout=120)
        return

    if shutil.which("ffplay"):
        _run(
            ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(wav)],
            timeout=120,
        )
        return

    if shutil.which("aplay"):
        _run(["aplay", "-q", str(wav)], timeout=120)
        return

    print(f"[tts] 无播放器，文件: {wav}")


def _synth_piper(cfg: dict[str, Any], text: str, voice: dict[str, Any], out_wav: Path) -> bool:
    tts = cfg.get("tts") or {}
    piper_cfg = {**(tts.get("piper") or {}), **(voice.get("piper") or {})}
    binary = shutil.which(str(piper_cfg.get("bin") or tts.get("piper", {}).get("bin") or "piper"))
    if not binary:
        binary = shutil.which("piper-tts")
    if not binary:
        return False
    model = work_path(cfg, piper_cfg.get("model") or "")
    if not model.exists():
        return False
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [binary, "--model", str(model), "--output_file", str(out_wav)]
    conf = piper_cfg.get("config")
    if conf:
        conf_p = work_path(cfg, conf)
        if conf_p.exists():
            cmd.extend(["--config", str(conf_p)])
    for key, flag in (
        ("length_scale", "--length_scale"),
        ("noise_scale", "--noise_scale"),
        ("noise_w", "--noise_w"),
    ):
        if key in piper_cfg and piper_cfg[key] is not None:
            cmd.extend([flag, str(piper_cfg[key])])
    r = _run(cmd, input=text)
    return r.returncode == 0 and out_wav.exists() and out_wav.stat().st_size > 44


def _synth_espeak(cfg: dict[str, Any], text: str, voice: dict[str, Any], out_wav: Path) -> bool:
    tts = cfg.get("tts") or {}
    es = {**(tts.get("espeak") or {}), **(voice.get("espeak") or {})}
    binary = shutil.which(str(es.get("bin") or "espeak-ng")) or shutil.which("espeak")
    if not binary:
        return False
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        binary,
        "-v", str(es.get("voice") or "zh"),
        "-s", str(int(es.get("speed") or 150)),
        "-p", str(int(es.get("pitch") or 50)),
        "-a", str(int(es.get("amplitude") or 100)),
        "-w", str(out_wav),
        text,
    ]
    r = _run(cmd)
    return r.returncode == 0 and out_wav.exists() and out_wav.stat().st_size > 44


def synthesize(cfg: dict[str, Any], text: str, *, voice_id: str | None = None) -> Path:
    text = (text or "").strip()
    if not text:
        raise ValueError("空文本无法合成")

    tts = cfg.get("tts") or {}
    if voice_id:
        voices = tts.get("voices") or {}
        if voice_id not in voices:
            raise KeyError(voice_id)
        voice = voices[voice_id]
        vid = voice_id
    else:
        vid, voice = get_active_voice(cfg)

    engine = str(voice.get("engine") or tts.get("engine") or "auto").lower()
    out_dir = work_path(cfg, tts.get("output_dir") or "audio/tts")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    out_wav = out_dir / f"{vid}_{stamp}.wav"

    ok = False
    if engine in ("piper", "auto"):
        ok = _synth_piper(cfg, text, voice, out_wav)
        if ok and (cfg.get("pipeline") or {}).get("verbose", True):
            print(f"[tts] piper ok → {out_wav.name} ({vid})")
    if not ok and engine in ("espeak", "auto", "piper"):
        ok = _synth_espeak(cfg, text, voice, out_wav)
        if ok and (cfg.get("pipeline") or {}).get("verbose", True):
            print(f"[tts] espeak ok → {out_wav.name} ({vid})")
    if not ok:
        raise RuntimeError(
            "TTS 失败：请安装 espeak-ng 或 piper，并检查 tts.voices 模型路径。\n"
            "  sudo apt install -y espeak-ng\n"
            "  或 bash scripts/setup_pi.sh"
        )
    return out_wav


def speak(cfg: dict[str, Any], text: str, *, voice_id: str | None = None, play: bool = True) -> Path:
    wav = synthesize(cfg, text, voice_id=voice_id)
    if play:
        _play(cfg, wav)
    return wav
