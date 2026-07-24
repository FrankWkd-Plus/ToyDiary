#!/usr/bin/env bash
# 从开发机同步 talk 到 Orange Pi（在 Windows Git Bash / 板子侧均可参考）
# 用法: TALK_HOST=192.168.43.149 TALK_PORT=19198 ./scripts/sync_to_pi.sh
set -euo pipefail
HOST="${TALK_HOST:-192.168.43.149}"
PORT="${TALK_PORT:-19198}"
USER="${TALK_USER:-root}"
REMOTE="${TALK_REMOTE:-/home/talk}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "sync $ROOT -> ${USER}@${HOST}:${PORT}:${REMOTE}"
ssh -p "$PORT" "${USER}@${HOST}" "mkdir -p '$REMOTE'"
# 排除大模型与录音缓存（模型在板子 setup 下载）
rsync -av -e "ssh -p $PORT" \
  --exclude 'models/' \
  --exclude 'audio/' \
  --exclude 'history/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude 'voices/*.onnx' \
  "$ROOT/" "${USER}@${HOST}:${REMOTE}/"

ssh -p "$PORT" "${USER}@${HOST}" "chmod +x $REMOTE/main.py $REMOTE/scripts/*.sh 2>/dev/null; ls -la $REMOTE"
echo "done"
