"""语音识别 STT — Vosk（默认）/ whisper.cpp 包装。"""

from __future__ import annotations

import json
import shutil
import subprocess
import wave
from pathlib import Path
from typing import Any

from .config import work_path


def _ensure_16k_mono(src: Path, dst: Path) -> Path:
    """用 ffmpeg 转 16k mono s16le wav；无 ffmpeg 则原样返回。"""
    if not shutil.which("ffmpeg"):
        return src
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-ac", "1", "-ar", "16000", "-sample_fmt", "s16",
        str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not dst.exists():
        return src
    return dst


def stt_vosk(cfg: dict[str, Any], wav_path: Path) -> str:
    try:
        from vosk import Model, KaldiRecognizer
    except ImportError as exc:
        raise RuntimeError(
            "未安装 vosk。请: pip install vosk\n"
            "并下载中文小模型到 models/vosk-model-small-cn-0.22"
        ) from exc

    stt = cfg.get("stt") or {}
    model_dir = work_path(cfg, stt.get("vosk_model_dir") or "models/vosk-model-small-cn-0.22")
    if not model_dir.exists():
        raise FileNotFoundError(
            f"Vosk 模型不存在: {model_dir}\n"
            "运行: bash scripts/setup_pi.sh  或手动下载\n"
            "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
        )

    use = wav_path
    if stt.get("force_16k_mono", True):
        tmp = work_path(cfg, "audio", "_stt_16k.wav")
        use = _ensure_16k_mono(wav_path, tmp)

    model = Model(str(model_dir))
    with wave.open(str(use), "rb") as wf:
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
            raise RuntimeError("WAV 需为 mono 16-bit；请安装 ffmpeg 或换源文件")
        rec = KaldiRecognizer(model, wf.getframerate())
        rec.SetWords(False)
        parts: list[str] = []
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            if rec.AcceptWaveform(data):
                j = json.loads(rec.Result())
                t = (j.get("text") or "").strip()
                if t:
                    parts.append(t)
        final = json.loads(rec.FinalResult())
        t = (final.get("text") or "").strip()
        if t:
            parts.append(t)
    text = "".join(parts).strip()
    # Vosk 中文结果常带空格
    text = text.replace(" ", "")
    return text


def stt_whisper_cpp(cfg: dict[str, Any], wav_path: Path) -> str:
    stt = cfg.get("stt") or {}
    w = stt.get("whisper") or {}
    bin_name = str(w.get("bin") or "whisper-cli")
    binary = shutil.which(bin_name) or bin_name
    model = work_path(cfg, w.get("model") or "models/ggml-tiny.bin")
    if not Path(binary).exists() and not shutil.which(bin_name):
        raise FileNotFoundError(f"whisper 可执行文件不存在: {bin_name}")
    if not model.exists():
        raise FileNotFoundError(f"whisper 模型不存在: {model}")
    use = wav_path
    if stt.get("force_16k_mono", True):
        tmp = work_path(cfg, "audio", "_stt_16k.wav")
        use = _ensure_16k_mono(wav_path, tmp)
    out_base = work_path(cfg, "audio", "_whisper_out")
    cmd = [
        binary, "-m", str(model), "-f", str(use),
        "-l", str(w.get("language") or "zh"),
        "-otxt", "-of", str(out_base),
        "-nt",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    txt = Path(str(out_base) + ".txt")
    if txt.exists():
        return txt.read_text(encoding="utf-8", errors="replace").strip()
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "whisper failed")
    return (r.stdout or "").strip()


def transcribe(cfg: dict[str, Any], wav_path: str | Path) -> str:
    wav_path = Path(wav_path)
    if not wav_path.exists():
        raise FileNotFoundError(wav_path)
    engine = str((cfg.get("stt") or {}).get("engine") or "vosk").lower()
    if engine in ("vosk", "auto"):
        try:
            return stt_vosk(cfg, wav_path)
        except Exception as exc:
            if engine == "vosk":
                raise
            print(f"[stt] vosk 失败 ({exc})，尝试 whisper_cpp")
            return stt_whisper_cpp(cfg, wav_path)
    if engine in ("whisper_cpp", "whisper"):
        return stt_whisper_cpp(cfg, wav_path)
    if engine == "external":
        raise RuntimeError("stt.engine=external 需自行接入")
    raise ValueError(f"未知 stt.engine: {engine}")
