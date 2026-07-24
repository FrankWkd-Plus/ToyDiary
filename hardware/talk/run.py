#!/usr/bin/env python3
"""一键启动对话：python run.py / python3 run.py

实时输出日志到终端，并写入 logs/talk.log。
默认：连接戒指 → 等录音 → STT → /api/chat → TTS 播放。

常用：
  python run.py
  python run.py --voice boy_soft
  python run.py --text "今天好累"
  python run.py --once audio/demo.wav
  python run.py --list-voices
"""

from __future__ import annotations

import argparse
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from lib.config import get_active_voice, list_voices, load_config, set_active_voice
from lib.chat_api import chat, load_history, save_history
from lib.logutil import event, get_logger, result, setup_logging, turn_begin, turn_end
from lib.stt import transcribe
from lib.tts import speak


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="ToyDairy 对话一键启动（戒指 → STT → chat → TTS）",
    )
    p.add_argument("--config", default=None, help="config.yaml 路径")
    p.add_argument("--voice", default=None, help="临时音色 id")
    p.add_argument("--set-voice", default=None, help="写入 active_voice 并退出")
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--once", default=None, metavar="WAV", help="本地 wav 跑一轮")
    p.add_argument("--text", default=None, help="跳过录音/STT，直接对话")
    p.add_argument("--no-play", action="store_true")
    p.add_argument("--max-turns", type=int, default=None)
    p.add_argument("--log-level", default=None, help="DEBUG/INFO/WARNING")
    return p.parse_args(argv)


def one_turn_from_wav(cfg: dict, wav: Path, *, play: bool = True) -> bool:
    log = get_logger()
    event("trigger", "收到音频", path=str(wav))
    try:
        event("stt", "开始识别")
        text = transcribe(cfg, wav)
        result("stt", bool(text), text=text)
        if not text:
            event("stt", "空识别，播报提示")
            speak(cfg, "我没听清，可以再说一次吗？", play=play)
            return False
        return one_turn_from_text(cfg, text, play=play)
    except Exception as exc:
        result("stt", False, str(exc))
        log.exception("STT 异常")
        try:
            speak(cfg, "识别出了点问题，我们再试一次好不好？", play=play)
        except Exception:
            pass
        return False


def one_turn_from_text(cfg: dict, text: str, *, play: bool = True) -> bool:
    log = get_logger()
    event("trigger", "用户文本就绪", text=text)
    hist = load_history(cfg)
    try:
        event("chat", "请求对话 API")
        reply = chat(cfg, text, hist)
        result("chat", bool(reply), reply=reply)
    except Exception as exc:
        result("chat", False, str(exc))
        log.exception("chat 异常")
        reply = str((cfg.get("chat") or {}).get("offline_reply") or "我好像走神了…")
    hist.append({"role": "user", "text": text})
    hist.append({"role": "toy", "text": reply})
    try:
        save_history(cfg, hist)
        event("history", "已保存", turns=len(hist))
    except Exception as exc:
        result("history", False, str(exc))

    try:
        event("tts", "开始合成播放")
        wav = speak(cfg, reply, play=play)
        result("tts", True, path=str(wav), play=play)
        return True
    except Exception as exc:
        result("tts", False, str(exc))
        log.exception("TTS 异常")
        return False


def run_loop(cfg: dict, args: argparse.Namespace) -> int:
    log = get_logger()
    play = not args.no_play
    mode = str((cfg.get("pipeline") or {}).get("mode") or "wait_record")
    max_turns = args.max_turns
    if max_turns is None:
        max_turns = int((cfg.get("pipeline") or {}).get("max_turns") or 0)

    if args.text is not None:
        turn_begin(1)
        ok = one_turn_from_text(cfg, args.text, play=play)
        turn_end(1, ok)
        return 0 if ok else 1

    if args.once:
        turn_begin(1)
        ok = one_turn_from_wav(cfg, Path(args.once), play=play)
        turn_end(1, ok)
        return 0 if ok else 1

    event(
        "run",
        "进入对话循环",
        mode=mode,
        ring_mac=(cfg.get("ring") or {}).get("mac"),
        max_turns=max_turns or "infinite",
    )
    log.info("请长按戒指录音；Ctrl+C 结束")

    turn = 0
    while True:
        if max_turns and turn >= max_turns:
            event("run", "达到 max_turns，退出", max_turns=max_turns)
            break
        turn += 1
        turn_begin(turn)
        ok = False
        try:
            if mode == "download_latest":
                from lib.ring_audio import download_latest
                import asyncio

                event("ring", "下载最新录音")
                wav = asyncio.run(download_latest(cfg))
            elif mode == "once":
                tw = (cfg.get("pipeline") or {}).get("test_wav")
                if not tw:
                    result("run", False, "pipeline.mode=once 需要 test_wav")
                    return 1
                wav = Path(tw)
            else:
                from lib.ring_audio import capture_recording

                event("ring", "等待戒指录音触发", mac=(cfg.get("ring") or {}).get("mac"))
                wav = capture_recording(cfg)
            result("ring", True, path=str(wav))
            ok = one_turn_from_wav(cfg, wav, play=play)
        except KeyboardInterrupt:
            log.info("用户中断 (Ctrl+C)")
            turn_end(turn, False)
            return 0
        except Exception as exc:
            result("ring", False, str(exc))
            log.exception("本轮异常")
            try:
                speak(cfg, "出了点小问题，我们再试一次好不好？", play=play)
            except Exception:
                pass
            if mode == "once":
                turn_end(turn, False)
                return 1
        turn_end(turn, ok)
    return 0


def _check_runtime_deps(log) -> None:
    """启动时检查关键依赖，缺啥打清楚，避免连戒指才炸。"""
    missing: list[str] = []
    try:
        import bleak  # noqa: F401
    except ImportError:
        missing.append("bleak (sudo apt install -y python3-bleak)")
    try:
        import yaml  # noqa: F401
    except ImportError:
        missing.append("yaml (sudo apt install -y python3-yaml)")
    # vosk 仅 STT 需要；文本模式可缺
    if missing:
        for m in missing:
            log.error("缺少依赖: %s", m)
        raise SystemExit(
            "依赖不足，请先安装后重试。\n"
            "  sudo apt install -y python3-bleak python3-yaml\n"
            "  或: cd /home/talk && bash scripts/setup_pi.sh"
        )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        cfg = load_config(args.config)
    except Exception as exc:
        print(f"加载配置失败: {exc}", file=sys.stderr)
        return 2

    setup_logging(cfg, level=args.log_level)
    log = get_logger()
    # 文本测试可不强求 bleak；默认循环需要
    if args.text is None and not args.list_voices and not args.set_voice:
        _check_runtime_deps(log)

    if args.list_voices:
        active, _ = get_active_voice(cfg)
        for vid, meta in list_voices(cfg).items():
            mark = "*" if vid == active else " "
            print(
                f" {mark} {vid:14}  {meta.get('label', '')}  "
                f"({meta.get('gender')}/{meta.get('style')})"
            )
        print(f"\n当前: {active}")
        return 0

    if args.set_voice:
        set_active_voice(cfg, args.set_voice, persist=True)
        log.info("已写入 active_voice=%s", args.set_voice)
        return 0

    if args.voice:
        set_active_voice(cfg, args.voice, persist=False)
        event("tts", "本会话音色", voice=args.voice)

    vid, vmeta = get_active_voice(cfg)
    event(
        "boot",
        "对话服务启动",
        voice=vid,
        label=vmeta.get("label"),
        config=cfg.get("_config_path"),
    )
    return run_loop(cfg, args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
