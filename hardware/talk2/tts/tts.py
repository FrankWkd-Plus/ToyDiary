#!/usr/bin/env python3
"""talk2/tts — 文本 → 对话 API → edge-tts → wav（可选有线播放）

对齐 docs/api.md：POST /api/chat

用法:
  python3 tts.py --text "今天我好累"
  python3 tts.py --text "你好" --voice boy_soft
  python3 tts.py --list-voices
  python3 tts.py --set-voice girl_soft
  python3 tts.py --text "嗨" --no-play
  python3 tts.py --text "嗨" --no-chat          # 跳过 API，直接把 --text 当朗读内容
  python3 tts.py --say "只朗读，不调 API"

依赖:
  pip install edge-tts pyyaml
  播放: aplay（alsa-utils）
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

# IPv4 优先（手机热点上 IPv6 易 errno 16）
_orig_getaddrinfo = socket.getaddrinfo


def _ipv4_first(host, port, family=0, type=0, proto=0, flags=0):
    try:
        infos = _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        if infos:
            return infos
    except OSError:
        pass
    return _orig_getaddrinfo(host, port, family, type, proto, flags)


def eprint(*a: object) -> None:
    print(*a, file=sys.stderr)


def load_config(path: Path | None = None) -> dict[str, Any]:
    if yaml is None:
        raise SystemExit("需要 PyYAML: pip install pyyaml  或  apt install python3-yaml")
    cfg_path = path or (ROOT / "config.yaml")
    if not cfg_path.exists():
        raise SystemExit(f"配置不存在: {cfg_path}")
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise SystemExit("config.yaml 根节点必须是 mapping")
    data["_config_path"] = str(cfg_path)
    data["_root"] = str(ROOT)
    return data


def save_active_voice(cfg_path: Path, voice_id: str) -> None:
    raw = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    raw.setdefault("tts", {})["active_voice"] = voice_id
    cfg_path.write_text(
        yaml.safe_dump(raw, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def chat_url(cfg: dict[str, Any]) -> str:
    c = cfg.get("chat") or {}
    if c.get("url"):
        return str(c["url"]).rstrip("/")
    base = str(c.get("base_url") or "https://toydiary.pages.dev").rstrip("/")
    path = str(c.get("path") or "/api/chat")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def list_voices(cfg: dict[str, Any]) -> None:
    tts = cfg.get("tts") or {}
    active = str(tts.get("active_voice") or "")
    voices = tts.get("voices") or {}
    for vid, meta in voices.items():
        mark = "*" if vid == active else " "
        print(
            f" {mark} {vid:14}  {meta.get('label', '')}  "
            f"({meta.get('gender')}/{meta.get('style')})  "
            f"edge={meta.get('edge_voice')}"
        )
    print(f"\n当前: {active}  （--voice 临时 / --set-voice 写入 config）")


def get_voice(cfg: dict[str, Any], voice_id: str | None = None) -> tuple[str, dict[str, Any]]:
    tts = cfg.get("tts") or {}
    vid = voice_id or str(tts.get("active_voice") or "girl_bright")
    voices = tts.get("voices") or {}
    if vid not in voices:
        raise SystemExit(f"未知音色: {vid}；可选: {', '.join(voices)}")
    return vid, voices[vid]


def normalize_speak_text(text: str, strip_stage: bool = True) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if strip_stage:
        t = re.sub(r"（[^）]*）", "", t)
        t = re.sub(r"\([^)]*\)", "", t)
        t = re.sub(r"\[[^\]]*\]", "", t)
        t = re.sub(r"【[^】]*】", "", t)
    t = t.replace("……", "…").replace("...", "…")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def load_history(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [
                {"role": str(x.get("role", "user")), "text": str(x.get("text", ""))}
                for x in data
                if isinstance(x, dict) and x.get("text")
            ]
    except (OSError, json.JSONDecodeError):
        pass
    return []


def save_history(path: Path, history: list[dict[str, str]], limit: int = 12) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(history[-limit:], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def call_chat_api(cfg: dict[str, Any], message: str) -> str:
    """POST /api/chat，对齐 docs/api.md。"""
    chat_cfg = cfg.get("chat") or {}
    message = message.strip()
    if not message:
        return str(chat_cfg.get("offline_reply") or "…")

    hist_path = ROOT / "history" / "chat_history.json"
    limit = int(chat_cfg.get("history_limit") or 12)
    hist = load_history(hist_path)
    toy = chat_cfg.get("toy") or {}
    body = {
        "message": message,
        "quietMode": bool(chat_cfg.get("quiet_mode", False)),
        "toy": {
            "name": str(toy.get("name") or "玩偶"),
            "role": str(toy.get("role") or "伙伴"),
            "traits": list(toy.get("traits") or []),
            "bio": str(toy.get("bio") or ""),
            "monologue": str(toy.get("monologue") or ""),
        },
        "history": hist[-limit:],
        "memories": list(chat_cfg.get("memories") or [])[:6],
    }
    url = chat_url(cfg)
    timeout = float(chat_cfg.get("timeout_s") or 60)
    retries = int(chat_cfg.get("retries") or 3)
    offline = str(chat_cfg.get("offline_reply") or "呜，我好像走神了…你再说一次好不好？")

    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    last_err: Any = None
    for attempt in range(1, retries + 1):
        print(f"[chat] POST {url} (try {attempt}/{retries})")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "ToyDairy-talk2-tts/1.0",
            },
            method="POST",
        )
        socket.getaddrinfo = _ipv4_first  # type: ignore[assignment]
        try:
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                raw = resp.read().decode("utf-8", "replace")
                status = int(resp.status)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace") if exc.fp else str(exc)
            status = int(exc.code)
        except (urllib.error.URLError, TimeoutError, OSError, ssl.SSLError) as exc:
            last_err = exc
            print(f"[chat] 网络错误: {exc}")
            time.sleep(0.4 * attempt + random.random() * 0.2)
            continue
        finally:
            socket.getaddrinfo = _orig_getaddrinfo  # type: ignore[assignment]

        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {}

        if status >= 400:
            err = payload.get("error") or raw[:200]
            print(f"[chat] HTTP {status}: {err}")
            last_err = err
            if status < 500 and status != 429:
                break
            time.sleep(0.5 * attempt)
            continue

        reply = (payload.get("reply") or "").strip()
        if reply:
            print(f"[chat] source={payload.get('source')} reply={reply!r}")
            hist.append({"role": "user", "text": message})
            hist.append({"role": "toy", "text": reply})
            save_history(hist_path, hist, limit)
            return reply
        last_err = f"empty reply: {raw[:200]}"
        print(f"[chat] {last_err}")

    print(f"[chat] 失败，使用离线回复 ({last_err})")
    return offline


async def edge_tts_save(
    text: str,
    out_path: Path,
    *,
    voice: str,
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%",
) -> Path:
    try:
        import edge_tts
    except ImportError as exc:
        raise SystemExit(
            "未安装 edge-tts。请执行:\n"
            "  python3 -m pip install --break-system-packages edge-tts\n"
            "  或: pip install edge-tts"
        ) from exc

    out_path.parent.mkdir(parents=True, exist_ok=True)
    # edge-tts 默认 mp3；用 ffmpeg 转 wav 更通用
    mp3_path = out_path.with_suffix(".mp3")
    communicate = edge_tts.Communicate(
        text,
        voice=voice,
        rate=rate,
        pitch=pitch,
        volume=volume,
    )
    await communicate.save(str(mp3_path))
    if not mp3_path.exists() or mp3_path.stat().st_size < 100:
        raise RuntimeError("edge-tts 未生成有效音频")

    if out_path.suffix.lower() == ".mp3":
        return mp3_path

    if shutil.which("ffmpeg"):
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(mp3_path),
            "-ac", "2", "-ar", "44100", "-sample_fmt", "s16",
            str(out_path),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and out_path.exists():
            try:
                mp3_path.unlink(missing_ok=True)  # type: ignore[call-arg]
            except TypeError:
                if mp3_path.exists():
                    mp3_path.unlink()
            return out_path
        eprint(f"[tts] ffmpeg 转 wav 失败，保留 mp3: {(r.stderr or '')[-200:]}")
        return mp3_path

    eprint("[tts] 无 ffmpeg，输出 mp3")
    return mp3_path


def _find_wire_play() -> Path:
    """定位 play2/wire_play.py。"""
    candidates = [
        ROOT.parent / "play2" / "wire_play.py",
        Path("/home/talk2/play2/wire_play.py"),
    ]
    for p in candidates:
        if p.exists():
            return p.resolve()
    raise FileNotFoundError(
        "找不到 play2/wire_play.py。请同步 hardware/talk2/play2 到板子 /home/talk2/play2/"
    )


def play_with_play2(path: Path, playback_cfg: dict[str, Any] | None = None) -> bool:
    """通过子进程调用: python3 wire_play.py ...（与你手动执行一致）。"""
    wire_py = _find_wire_play()
    pb = dict(playback_cfg or {})
    wav = Path(path).resolve()
    if not wav.exists():
        eprint(f"[play] 文件不存在: {wav}")
        return False

    cmd = [sys.executable, str(wire_py), str(wav)]
    if pb.get("device"):
        cmd.extend(["--device", str(pb["device"])])
    if pb.get("volume") is not None:
        cmd.extend(["--volume", str(int(pb["volume"]))])
    if pb.get("resample"):
        cmd.append("--resample")

    # 使用 play2 自己的 config.yaml（若存在）
    play2_cfg = wire_py.parent / "config.yaml"
    if play2_cfg.exists():
        cmd.extend(["--config", str(play2_cfg)])

    print(f"[play] 子进程: {' '.join(cmd)}")
    # 不 capture，实时看到 aplay 输出（与手动 python3 wire_play.py 一致）
    r = subprocess.run(cmd, timeout=600)
    if r.returncode == 0:
        print("[play] wire_play.py OK")
        return True
    eprint(f"[play] wire_play.py 失败 rc={r.returncode}")
    return False


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="文本→API→edge-tts→wav")
    p.add_argument("--text", default=None, help="用户输入（会先调对话 API）")
    p.add_argument("--say", default=None, help="直接朗读该文本（不调 API）")
    p.add_argument("--no-chat", action="store_true", help="与 --text 联用：不调 API，直接朗读 text")
    p.add_argument("--voice", default=None, help="音色 id")
    p.add_argument("--set-voice", default=None, help="写入 config active_voice 并退出")
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--config", type=Path, default=None)
    p.add_argument("--out", type=Path, default=None, help="输出 wav 路径")
    p.add_argument("--no-play", action="store_true")
    p.add_argument("--play", action="store_true", help="强制播放")
    args = p.parse_args(argv)

    cfg = load_config(args.config)
    cfg_path = Path(cfg["_config_path"])

    if args.list_voices:
        list_voices(cfg)
        return 0

    if args.set_voice:
        get_voice(cfg, args.set_voice)  # validate
        save_active_voice(cfg_path, args.set_voice)
        print(f"已写入 active_voice={args.set_voice}")
        return 0

    if not args.text and not args.say:
        eprint("请提供 --text 或 --say")
        p.print_help()
        return 2

    vid, vmeta = get_voice(cfg, args.voice)
    print(f"[tts] voice={vid} ({vmeta.get('label')}) edge={vmeta.get('edge_voice')}")

    # 1) 得到要朗读的文本
    if args.say is not None:
        speak_text = args.say
        print(f"[input] say={speak_text!r}")
    elif args.no_chat:
        speak_text = args.text or ""
        print(f"[input] text(no-chat)={speak_text!r}")
    else:
        user_msg = args.text or ""
        print(f"[input] user={user_msg!r}")
        speak_text = call_chat_api(cfg, user_msg)

    tts_cfg = cfg.get("tts") or {}
    speak_text = normalize_speak_text(
        speak_text,
        strip_stage=bool(tts_cfg.get("strip_stage_directions", True)),
    )
    if not speak_text:
        eprint("朗读文本为空")
        return 1
    print(f"[tts] speak={speak_text!r}")

    # 2) edge-tts
    out_dir = ROOT / str(tts_cfg.get("output_dir") or "output")
    stamp = time.strftime("%Y%m%d_%H%M%S")
    out_path = args.out or (out_dir / f"{vid}_{stamp}.wav")
    if not out_path.is_absolute():
        out_path = (ROOT / out_path).resolve() if not str(out_path).startswith(str(ROOT)) else out_path

    rate = str(vmeta.get("rate") or tts_cfg.get("default_rate") or "+0%")
    pitch = str(vmeta.get("pitch") or tts_cfg.get("default_pitch") or "+0Hz")
    volume = str(vmeta.get("volume") or tts_cfg.get("default_volume") or "+0%")
    edge_voice = str(vmeta.get("edge_voice") or "zh-CN-XiaoyiNeural")

    print(f"[tts] edge-tts rate={rate} pitch={pitch} volume={volume}")
    audio = asyncio.run(
        edge_tts_save(
            speak_text,
            out_path,
            voice=edge_voice,
            rate=rate,
            pitch=pitch,
            volume=volume,
        )
    )
    print(f"[tts] saved {audio} ({audio.stat().st_size} bytes)")

    # 3) play — 复用 talk2/play2 有线播放模块
    pb = cfg.get("playback") or {}
    do_play = bool(pb.get("enabled", True) and tts_cfg.get("auto_play", True))
    if args.no_play:
        do_play = False
    if args.play:
        do_play = True
    if do_play:
        try:
            ok = play_with_play2(audio, pb)
            if not ok:
                eprint("[play] play2 播放失败")
                return 1
        except Exception as exc:
            eprint(f"[play] play2 调用异常: {exc}")
            return 1

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n中断")
        raise SystemExit(130)
