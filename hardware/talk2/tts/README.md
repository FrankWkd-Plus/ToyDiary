# talk2 / tts — 文本 → 对话 API → edge-tts → wav

## 流程

```
--text "今天我好累"
    → POST /api/chat
    → edge-tts 流式音频块
    → 管道写入 mpv（边下边播，降低首音延迟）
    → 可选同时保存 output/*.mp3|wav
```

回退模式（`--no-stream` 或 mpv/流式失败）：

```
edge-tts 完整 save → wire_play.py 播放
```

## 用法

```bash
cd /home/talk2/tts
python3 tts.py --text "今天我好累"          # 默认流式
python3 tts.py --say "你好" --stream
python3 tts.py --say "你好" --no-stream     # 旧路径：完整生成+wire_play
python3 tts.py --say "你好" --no-save       # 流式不落盘
python3 tts.py --list-voices
```

依赖：`edge-tts`、`mpv`（流式）、`ffmpeg`（可选转 wav）、`alsa-utils`。

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
