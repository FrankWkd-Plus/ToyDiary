# talk2 / tts — 文本 → 对话 API → edge-tts → wav

## 流程

```
--text "今天我好累"
    → POST https://toydiary.pages.dev/api/chat   （docs/api.md）
    → edge-tts 合成
    → output/*.wav
    → 子进程: python3 ../play2/wire_play.py <wav>  有线播放
```

播放通过**命令行调用** `python3 wire_play.py`（与手动执行一致），不 import 模块。

## 用法

```bash
cd /home/talk2/tts
python3 tts.py --list-voices
python3 tts.py --text "今天我好累"
python3 tts.py --text "你好" --voice boy_soft
python3 tts.py --set-voice girl_bright
python3 tts.py --say "只朗读不调API"
python3 tts.py --text "嗨" --no-chat --no-play
```

## 音色（config.yaml）

| id | 标签 | edge voice | 备注 |
|----|------|------------|------|
| `girl_soft` ★默认 | 软萌豆豆（女·小孩） | zh-CN-XiaoyiNeural | 标准普通话 |
| `girl_bright` | 元气糖糖（女·小孩） | zh-CN-XiaoshuangNeural | 标准普通话童声 |
| `boy_soft` | 软乎阿团（男·小孩） | zh-CN-YunxiaNeural | 标准普通话 |
| `boy_bright` | 蹦蹦阿栗（男·小孩） | zh-CN-YunxiNeural | 标准普通话 |

改 `tts.active_voice` 或 `--voice` / `--set-voice`。

## 依赖

```bash
sudo apt install -y python3-yaml ffmpeg alsa-utils
python3 -m pip install --break-system-packages edge-tts
```

## 配置

- `chat.*`：API 地址与玩偶人格（对齐 docs/api.md）
- `tts.voices.*`：edge 音色与 rate/pitch
- `playback.*`：有线设备与音量
