"""简单流水线日志：同时打到终端与文件，便于看触发与处理结果。"""

from __future__ import annotations

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


_LOGGER_NAME = "talk"
_configured = False


def setup_logging(cfg: dict[str, Any] | None = None, *, level: str | None = None) -> logging.Logger:
    """配置 root talk logger。可重复调用，仅首次生效（除非 force）。"""
    global _configured
    log = logging.getLogger(_LOGGER_NAME)
    if _configured:
        return log

    pipe = (cfg or {}).get("pipeline") or {}
    log_cfg = (cfg or {}).get("log") or {}
    level_name = (level or log_cfg.get("level") or "INFO").upper()
    lvl = getattr(logging, level_name, logging.INFO)

    log.setLevel(lvl)
    log.handlers.clear()
    log.propagate = False

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-5s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(lvl)
    sh.setFormatter(fmt)
    log.addHandler(sh)

    # 文件日志
    if log_cfg.get("enabled", True):
        work = Path((cfg or {}).get("_work_root") or Path(__file__).resolve().parent.parent)
        rel = log_cfg.get("dir") or pipe.get("log_dir") or "logs"
        log_dir = Path(rel) if Path(rel).is_absolute() else work / rel
        log_dir.mkdir(parents=True, exist_ok=True)
        fname = log_cfg.get("file") or "talk.log"
        path = log_dir / fname
        fh = logging.FileHandler(path, encoding="utf-8")
        fh.setLevel(lvl)
        fh.setFormatter(fmt)
        log.addHandler(fh)
        log.info("日志文件: %s", path)

    _configured = True
    return log


def get_logger() -> logging.Logger:
    return logging.getLogger(_LOGGER_NAME)


def event(stage: str, msg: str, **fields: Any) -> None:
    """结构化一行：阶段 + 说明 + 可选字段（触发/结果检测用）。"""
    log = get_logger()
    extra = ""
    if fields:
        parts = [f"{k}={v!r}" for k, v in fields.items()]
        extra = " | " + " ".join(parts)
    log.info("[%s] %s%s", stage, msg, extra)


def result(stage: str, ok: bool, msg: str = "", **fields: Any) -> None:
    log = get_logger()
    status = "OK" if ok else "FAIL"
    extra = ""
    if fields:
        extra = " | " + " ".join(f"{k}={v!r}" for k, v in fields.items())
    line = f"[{stage}] {status}"
    if msg:
        line += f" | {msg}"
    line += extra
    if ok:
        log.info("%s", line)
    else:
        log.error("%s", line)


def turn_begin(n: int) -> None:
    get_logger().info("======== 第 %s 轮开始 %s ========", n, datetime.now().strftime("%H:%M:%S"))


def turn_end(n: int, ok: bool) -> None:
    result("turn", ok, f"第 {n} 轮结束")
