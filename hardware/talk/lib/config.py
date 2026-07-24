"""配置加载与音色切换。"""

from __future__ import annotations

import copy
import os
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config.yaml"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in override.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    cfg_path = Path(path) if path else Path(os.environ.get("TALK_CONFIG", DEFAULT_CONFIG))
    if not cfg_path.is_absolute():
        cfg_path = (ROOT / cfg_path).resolve()
    if yaml is None:
        raise RuntimeError("需要 PyYAML：pip install pyyaml")
    if not cfg_path.exists():
        raise FileNotFoundError(f"配置不存在: {cfg_path}")
    with cfg_path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError("config.yaml 根节点必须是 mapping")
    data["_config_path"] = str(cfg_path)
    data["_root"] = str(ROOT)
    # 解析相对路径根
    pipe = data.setdefault("pipeline", {})
    root = pipe.get("root") or str(ROOT)
    data["_work_root"] = str(Path(root).resolve() if Path(root).is_absolute() else (ROOT / root).resolve() if root != str(ROOT) else ROOT)
    return data


def work_path(cfg: dict[str, Any], *parts: str) -> Path:
    base = Path(cfg.get("_work_root") or ROOT)
    p = base
    for part in parts:
        if not part:
            continue
        p = Path(part) if Path(part).is_absolute() else p / part
    return p


def chat_url(cfg: dict[str, Any]) -> str:
    c = cfg.get("chat") or {}
    if c.get("url"):
        return str(c["url"]).rstrip("/")
    base = str(c.get("base_url") or "https://toydairy.pages.dev").rstrip("/")
    path = str(c.get("path") or "/api/chat")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def list_voices(cfg: dict[str, Any]) -> dict[str, dict[str, Any]]:
    tts = cfg.get("tts") or {}
    return dict(tts.get("voices") or {})


def get_active_voice(cfg: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    tts = cfg.get("tts") or {}
    vid = str(tts.get("active_voice") or "girl_soft")
    voices = list_voices(cfg)
    if vid not in voices:
        raise KeyError(f"未知音色 id: {vid}；可选: {', '.join(voices)}")
    return vid, voices[vid]


def set_active_voice(cfg: dict[str, Any], voice_id: str, *, persist: bool = False) -> dict[str, Any]:
    voices = list_voices(cfg)
    if voice_id not in voices:
        raise KeyError(f"未知音色 id: {voice_id}；可选: {', '.join(voices)}")
    cfg.setdefault("tts", {})["active_voice"] = voice_id
    if persist:
        path = Path(cfg["_config_path"])
        # 只改 active_voice，保留注释困难；整文件 dump
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        raw.setdefault("tts", {})["active_voice"] = voice_id
        path.write_text(
            yaml.safe_dump(raw, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
    return cfg
