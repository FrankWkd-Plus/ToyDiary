# hardware/talk — 戒指语音对话流水线

## 数据流（固定）

```
用户长按戒指录音
    → BLE（ring_sound / MAC 唯一）
    → Orange Pi
    → STT（开源：默认 Vosk 中文小模型）
    → POST /api/chat（docs/api.md，Cloudflare Pages）
    → TTS（开源：Piper 优先，espeak-ng 降级）
    → aplay 播放
```

## 目录

| 路径 | 说明 |
|------|------|
| `config.yaml` | **API / 音色 / 戒指 MAC / STT·TTS / 日志 全部可配** |
| `run.py` | **一键启动**（推荐）：`python run.py`，实时日志 |
| `main.py` | 兼容入口，转发到 `run.py` |
| `logs/talk.log` | 触发与处理结果日志 |
| `lib/` | config / stt / tts / chat_api / ring_audio / logutil |
| `scripts/setup_pi.sh` | 板端装依赖 + 下模型 |
| `scripts/sync_to_pi.sh` | 同步到 `/home/talk` |
| `voices/` | Piper onnx（可选） |
| `models/` | Vosk 模型（板端下载） |
| `audio/` | 录音与 TTS 缓存 |
| `history/` | 对话历史 JSON |

本地 `hardware/talk` 与板子 `/home/talk` 应对齐（大模型可只在板子）。

## 音色预设（玩偶向）

在 `config.yaml` → `tts.active_voice` 切换：

| id | 标签 | 性别 | 风格 |
|----|------|------|------|
| `girl_soft` | 软萌小棉（女） | 女 | 慢、软、贴耳 |
| `girl_bright` | 雀跃小糖（女） | 女 | 稍快、明亮 |
| `boy_soft` | 温柔阿柚（男） | 男 | 偏低、干净 |
| `boy_bright` | 元气阿栗（男） | 男 | 稍快、少年感 |

```bash
python run.py --list-voices
python run.py --set-voice boy_soft    # 写入 config
python run.py --voice girl_bright --text "你好"
```

男声在仅有 `zh_CN-huayan` 时主要靠 **espeak pitch/speed** 区分；有 Piper 时共用模型 + `length_scale` 调气质。可后续换成更多开源中文音色文件，只改 `config.yaml` 路径即可。

## 配置要点（`config.yaml`）

- `ring.mac`：戒指唯一 MAC（多 ring 环境禁止按名猜测）
- `chat.base_url` / `chat.path` / `chat.url`：对话 API
- `chat.toy.*`：玩偶人格（对齐 `/api/chat` body）
- `stt.engine`：`vosk` | `whisper_cpp`
- `tts.active_voice` + `tts.voices.*`

## 板子安装

```bash
# 开发机同步
TALK_HOST=192.168.43.149 TALK_PORT=19198 bash scripts/sync_to_pi.sh

# 板子上
ssh -p 19198 root@192.168.43.149
cd /home/talk
bash scripts/setup_pi.sh
# 放入 ring_sound.py（若 setup 未拷到）
cp /path/to/ring_sound.py /home/talk/

python run.py --list-voices
python run.py --text "今天有点累"
python run.py          # 等戒指长按录音（实时日志 + logs/talk.log）
```

## 方案说明（为何这样选）

在 **不改**「语音进 Pi → API → Pi 出声」的前提下：

| 模块 | 选用 | 原因（Orange Pi 3B ~2GB / aarch64） |
|------|------|--------------------------------------|
| STT | **Vosk small-cn** | 纯离线、体积小、ARM 友好；备选 whisper.cpp tiny |
| TTS | **Piper + espeak-ng 降级** | Piper 音质更好；无模型时 espeak 也能跑通演示 |
| Chat | **现有 `/api/chat`** | 与 Web 同一玩偶人格契约（docs/api.md） |
| 播放 | **aplay / bluealsa** | 板载或已连的 MINISO 耳机 |

**可选增强（未默认启用，需你同意后再上）：**

1. **Sherpa-ONNX**（SenseVoice / Zipformer）— 中文识别往往比 Vosk 准，仍离线，需多装 onnxruntime。  
2. **ChatTTS / GPT-SoVITS 云端开源推理** — 音色更“玩偶”，但重，不适合默认板端。  
3. **板端小 LLM**（如 Qwen2-0.5B）— 可离线对话，但与当前 Web 人格/记忆 API 分叉，且吃内存。  

当前默认方案：**可行性高、依赖开源、2GB 内存可跑通闭环**；先保证链路，再换更强 STT/TTS 只需改 `config.yaml` 与引擎实现。
