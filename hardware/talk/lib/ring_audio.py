"""戒指录音获取 — 基于 hardware/ring/ring_sound.py。"""

from __future__ import annotations

import asyncio
import shutil
import sys
from pathlib import Path
from typing import Any

from .config import work_path


def _ensure_bleak() -> None:
    """BLE 依赖检查；缺 bleak 时给出可执行的安装命令。"""
    try:
        import bleak  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "缺少 BLE 依赖 bleak，无法连接戒指。\n"
            "  推荐 (Armbian/Debian):  sudo apt install -y python3-bleak\n"
            "  或:  sudo pip3 install --break-system-packages bleak\n"
            "装好后重新:  python3 run.py"
        ) from exc


def _ensure_ring_sdk() -> Any:
    """导入 ring_sound：优先 talk 旁 symlink/copy，再试 ../ring。"""
    _ensure_bleak()
    talk_root = Path(__file__).resolve().parent.parent
    candidates = [
        talk_root / "ring_sound.py",
        talk_root.parent / "ring" / "ring_sound.py",
        Path("/home/blt/../ring/ring_sound.py"),
        Path("/home/talk/ring_sound.py"),
        Path("/home/ring/ring_sound.py"),
    ]
    for p in candidates:
        if p.exists():
            parent = str(p.parent)
            if parent not in sys.path:
                sys.path.insert(0, parent)
            import ring_sound as sdk  # type: ignore
            return sdk
    raise FileNotFoundError(
        "找不到 ring_sound.py。请复制或链接到 talk 目录：\n"
        "  cp ../ring/ring_sound.py ./ring_sound.py\n"
        "  或: ln -s /path/to/ring_sound.py /home/talk/ring_sound.py"
    )


async def _wait_and_save(cfg: dict[str, Any]) -> Path:
    sdk = _ensure_ring_sdk()
    ring_cfg = cfg.get("ring") or {}
    mac = str(ring_cfg.get("mac") or "").strip()
    if not mac:
        raise ValueError("config.ring.mac 未设置")
    timeout = float(ring_cfg.get("record_timeout_s") or 120)
    audio_dir = work_path(cfg, (cfg.get("pipeline") or {}).get("audio_dir") or "audio")
    audio_dir.mkdir(parents=True, exist_ok=True)

    if (cfg.get("pipeline") or {}).get("verbose", True):
        print(f"[ring] 连接 {mac} …")

    # 优先使用已配置 MAC；不按名称猜测
    async with sdk.RingSoundClient(address=mac) as ring:
        if (cfg.get("pipeline") or {}).get("verbose", True):
            print("[ring] 已连接。请长按戒指录音，松手后自动接收…")
        file_index, raw_audio = await sdk.receive_auto_audio_file(
            ring,
            timeout_s=timeout,
        )
        bundle = sdk.save_audio_bundle(
            file_index=file_index,
            data=raw_audio,
            output_dir=str(audio_dir),
        )
        play_path = Path(bundle.play_path) if bundle.play_path else None
        raw_path = Path(bundle.raw_path) if bundle.raw_path else None
        if play_path and play_path.exists():
            return play_path
        if raw_path and raw_path.exists() and shutil.which("ffmpeg"):
            # 再尝试解码
            wav = audio_dir / f"ring_{file_index}.wav"
            try:
                sdk.decode_audio_to_wav(raw_path.read_bytes() if False else raw_audio, wav)  # type: ignore
            except Exception:
                pass
            if wav.exists():
                return wav
        raise RuntimeError(
            f"未得到可播放 WAV（可能缺 ffmpeg）。raw={raw_path} play={play_path}"
        )


def capture_recording(cfg: dict[str, Any]) -> Path:
    """阻塞：连戒指 → 等录音 → 返回 wav 路径。"""
    return asyncio.run(_wait_and_save(cfg))


async def download_latest(cfg: dict[str, Any]) -> Path:
    """连接后下载最新一条已存录音。"""
    sdk = _ensure_ring_sdk()
    ring_cfg = cfg.get("ring") or {}
    mac = str(ring_cfg.get("mac") or "").strip()
    audio_dir = work_path(cfg, (cfg.get("pipeline") or {}).get("audio_dir") or "audio")
    audio_dir.mkdir(parents=True, exist_ok=True)
    async with sdk.RingSoundClient(address=mac) as ring:
        count_info = await sdk.get_audio_file_count(ring)
        # 兼容不同返回形态
        n = getattr(count_info, "count", None)
        if n is None and isinstance(count_info, (int, float)):
            n = int(count_info)
        if n is None and isinstance(count_info, dict):
            n = int(count_info.get("count") or count_info.get("file_count") or 0)
        n = int(n or 0)
        if n <= 0:
            raise RuntimeError("戒指上没有录音文件")
        idx = n - 1
        raw = await sdk.download_audio_file(ring, file_index=idx)
        data = raw if isinstance(raw, (bytes, bytearray)) else getattr(raw, "data", None) or raw
        bundle = sdk.save_audio_bundle(file_index=idx, data=data, output_dir=str(audio_dir))
        play_path = Path(bundle.play_path)
        if not play_path.exists():
            raise RuntimeError("下载成功但 WAV 解码失败，请安装 ffmpeg")
        return play_path
