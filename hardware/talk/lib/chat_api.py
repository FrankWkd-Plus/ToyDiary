"""对话 API 客户端 — 对齐 docs/api.md POST /api/chat。

针对 Orange Pi / 手机热点环境：
- 强制优先 IPv4（避免 getaddrinfo 先走坏掉的 IPv6 导致 errno 16 Device or resource busy）
- 自动重试
- 按文档构造 body（message/toy/history/memories/quietMode）
- HTTP 错误时解析 JSON error 字段
"""

from __future__ import annotations

import json
import random
import socket
import ssl
import time
import urllib.error
import urllib.request
from typing import Any

from .config import chat_url, work_path

# 让本模块内的 HTTPS 优先用 IPv4
_orig_getaddrinfo = socket.getaddrinfo


def _getaddrinfo_ipv4_first(host, port, family=0, type=0, proto=0, flags=0):
    """Prefer AF_INET results; fall back to full list if no v4."""
    try:
        infos = _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        if infos:
            return infos
    except OSError:
        pass
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


def _patch_ipv4_first() -> None:
    socket.getaddrinfo = _getaddrinfo_ipv4_first  # type: ignore[assignment]


def _unpatch_ipv4_first() -> None:
    socket.getaddrinfo = _orig_getaddrinfo  # type: ignore[assignment]


def load_history(cfg: dict[str, Any]) -> list[dict[str, str]]:
    path = work_path(cfg, (cfg.get("pipeline") or {}).get("history_file") or "history/chat_history.json")
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            out: list[dict[str, str]] = []
            for x in data:
                if not isinstance(x, dict) or not x.get("text"):
                    continue
                role = str(x.get("role", "user"))
                if role not in ("user", "toy", "assistant"):
                    role = "user"
                out.append({"role": role, "text": str(x["text"])})
            return out
    except (OSError, json.JSONDecodeError):
        pass
    return []


def save_history(cfg: dict[str, Any], history: list[dict[str, str]]) -> None:
    path = work_path(cfg, (cfg.get("pipeline") or {}).get("history_file") or "history/chat_history.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    limit = int((cfg.get("chat") or {}).get("history_limit") or 12)
    path.write_text(
        json.dumps(history[-limit:], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _offline(cfg: dict[str, Any]) -> str:
    return str((cfg.get("chat") or {}).get("offline_reply") or "我好像走神了…你再说一次好不好？")


def _build_body(cfg: dict[str, Any], message: str, hist: list[dict[str, str]]) -> dict[str, Any]:
    chat_cfg = cfg.get("chat") or {}
    limit = int(chat_cfg.get("history_limit") or 12)
    toy = chat_cfg.get("toy") or {}
    # 文档字段：name/role/traits/bio/monologue
    toy_body = {
        "name": str(toy.get("name") or "玩偶"),
        "role": str(toy.get("role") or "伙伴"),
        "traits": list(toy.get("traits") or []),
        "bio": str(toy.get("bio") or ""),
        "monologue": str(toy.get("monologue") or ""),
    }
    memories = chat_cfg.get("memories") or []
    if not isinstance(memories, list):
        memories = []
    return {
        "message": message,
        "quietMode": bool(chat_cfg.get("quiet_mode", False)),
        "toy": toy_body,
        "history": hist[-limit:],
        "memories": memories[:6],
    }


def _http_post_json(url: str, body: dict[str, Any], timeout: float) -> tuple[int, str]:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "User-Agent": "ToyDairy-talk/1.0 (OrangePi; +https://toydiary.pages.dev)",
        },
        method="POST",
    )
    ctx = ssl.create_default_context()
    _patch_ipv4_first()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return int(resp.status), raw
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace") if exc.fp else str(exc)
        return int(exc.code), raw
    finally:
        _unpatch_ipv4_first()


def chat(cfg: dict[str, Any], message: str, history: list[dict[str, str]] | None = None) -> str:
    """调用 POST /api/chat，返回 reply。失败重试后用 offline_reply。"""
    message = (message or "").strip()
    chat_cfg = cfg.get("chat") or {}
    if not message:
        return _offline(cfg)

    hist = history if history is not None else load_history(cfg)
    body = _build_body(cfg, message, hist)
    url = chat_url(cfg)
    timeout = float(chat_cfg.get("timeout_s") or 60)
    retries = int(chat_cfg.get("retries") or 3)
    verbose = bool((cfg.get("pipeline") or {}).get("verbose", True))

    last_err: Exception | str | None = None
    for attempt in range(1, retries + 1):
        try:
            if verbose:
                print(f"[chat] POST {url} (try {attempt}/{retries})")
            status, raw = _http_post_json(url, body, timeout)
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {}

            if status >= 400:
                err = payload.get("error") or raw[:200] or f"HTTP {status}"
                hint = payload.get("hint") or ""
                last_err = f"HTTP {status}: {err} {hint}".strip()
                if verbose:
                    print(f"[chat] {last_err}")
                # 4xx 除 429 外不重试
                if status < 500 and status != 429:
                    break
            else:
                reply = (payload.get("reply") or "").strip()
                if reply:
                    if verbose and payload.get("source"):
                        print(f"[chat] source={payload.get('source')}")
                    return reply
                last_err = f"empty reply: {raw[:200]}"
                if verbose:
                    print(f"[chat] {last_err}")
        except (urllib.error.URLError, TimeoutError, OSError, ssl.SSLError) as exc:
            last_err = exc
            if verbose:
                print(f"[chat] 网络错误 try {attempt}: {exc}")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if verbose:
                print(f"[chat] 异常 try {attempt}: {exc}")

        # 退避
        if attempt < retries:
            time.sleep(0.4 * attempt + random.random() * 0.2)

    if verbose:
        print(f"[chat] API 最终失败 ({last_err}); 使用离线回复")
    return _offline(cfg)
