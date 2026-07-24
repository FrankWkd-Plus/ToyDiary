#!/usr/bin/env bash
# Orange Pi / Armbian：安装 talk 依赖（开源 STT/TTS）
set -euo pipefail

TALK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TALK_ROOT"
echo "TALK_ROOT=$TALK_ROOT"

export DEBIAN_FRONTEND=noninteractive

echo "== apt packages =="
apt-get update -qq
apt-get install -y \
  python3 python3-pip python3-venv \
  python3-yaml python3-bleak \
  ffmpeg espeak-ng alsa-utils \
  unzip wget curl \
  bluez bluez-tools \
  || true

# bluealsa 已在蓝牙阶段装过则跳过
apt-get install -y bluez-alsa-utils libasound2-plugin-bluez 2>/dev/null || true

echo "== python packages =="
# bleak 优先用 apt 的 python3-bleak（与系统 BlueZ 更合拍）
python3 -c "import bleak" 2>/dev/null || \
  apt-get install -y python3-bleak || \
  python3 -m pip install --break-system-packages bleak || true

python3 -c "import yaml" 2>/dev/null || \
  apt-get install -y python3-yaml || \
  python3 -m pip install --break-system-packages pyyaml || true

python3 -m pip install --upgrade pip -q 2>/dev/null || true
python3 -c "import vosk" 2>/dev/null || \
  python3 -m pip install --break-system-packages vosk 2>/dev/null || \
  python3 -m pip install vosk || true

python3 -c "import bleak, yaml; print('deps: bleak+yaml ok')"

echo "== Vosk 中文小模型 =="
MODEL_DIR="$TALK_ROOT/models/vosk-model-small-cn-0.22"
if [[ ! -d "$MODEL_DIR" ]]; then
  mkdir -p "$TALK_ROOT/models"
  ZIP="$TALK_ROOT/models/vosk-model-small-cn-0.22.zip"
  URL="https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
  echo "下载 $URL …"
  wget -O "$ZIP" "$URL" || curl -L -o "$ZIP" "$URL"
  unzip -o "$ZIP" -d "$TALK_ROOT/models"
  rm -f "$ZIP"
else
  echo "模型已存在: $MODEL_DIR"
fi

echo "== ring_sound.py =="
if [[ ! -f "$TALK_ROOT/ring_sound.py" ]]; then
  if [[ -f /home/blt/../ring/ring_sound.py ]]; then
    cp -a /home/ring/ring_sound.py "$TALK_ROOT/ring_sound.py" 2>/dev/null || true
  fi
  if [[ -f "$TALK_ROOT/../ring/ring_sound.py" ]]; then
    cp -a "$TALK_ROOT/../ring/ring_sound.py" "$TALK_ROOT/ring_sound.py"
  fi
fi
[[ -f "$TALK_ROOT/ring_sound.py" ]] && echo "ring_sound.py ok" || echo "请手动放入 ring_sound.py"

echo "== Piper 中文音色（可选，体积较大）=="
VOICES="$TALK_ROOT/voices"
mkdir -p "$VOICES"
# HuggingFace rhasspy piper voices — 中文 huayan medium
PIPER_ONNX="$VOICES/zh_CN-huayan-medium.onnx"
if [[ ! -f "$PIPER_ONNX" ]]; then
  echo "尝试下载 Piper zh_CN-huayan-medium …"
  BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium"
  wget -O "$PIPER_ONNX" "$BASE/zh_CN-huayan-medium.onnx" || \
    curl -L -o "$PIPER_ONNX" "$BASE/zh_CN-huayan-medium.onnx" || \
    echo "Piper 模型下载失败，将使用 espeak-ng 降级"
  wget -O "$PIPER_ONNX.json" "$BASE/zh_CN-huayan-medium.onnx.json" || \
    curl -L -o "$PIPER_ONNX.json" "$BASE/zh_CN-huayan-medium.onnx.json" || true
else
  echo "Piper 模型已存在"
fi

# 安装 piper 二进制（若无）
if ! command -v piper >/dev/null 2>&1; then
  echo "未检测到 piper 可执行文件。可选："
  echo "  pip install piper-tts"
  echo "  或从 https://github.com/rhasspy/piper/releases 下载 aarch64"
  python3 -m pip install --break-system-packages piper-tts 2>/dev/null || true
fi

mkdir -p "$TALK_ROOT/audio/tts" "$TALK_ROOT/history"
chmod +x "$TALK_ROOT/main.py" "$TALK_ROOT/scripts/"*.sh 2>/dev/null || true

echo
echo "完成。测试："
echo "  cd $TALK_ROOT"
echo "  python3 main.py --list-voices"
echo "  python3 main.py --text '你好呀，小棉'"
echo "  python3 main.py   # 等戒指录音"
