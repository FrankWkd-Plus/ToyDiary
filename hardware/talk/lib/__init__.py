"""lib 包标记。"""

from .config import load_config, list_voices, get_active_voice, set_active_voice, chat_url
from .chat_api import chat, load_history, save_history
from .stt import transcribe
from .tts import speak, synthesize
from .logutil import setup_logging, get_logger, event, result

__all__ = [
    "load_config",
    "list_voices",
    "get_active_voice",
    "set_active_voice",
    "chat_url",
    "chat",
    "load_history",
    "save_history",
    "transcribe",
    "speak",
    "synthesize",
    "setup_logging",
    "get_logger",
    "event",
    "result",
]
