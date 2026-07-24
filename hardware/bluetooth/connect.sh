#!/usr/bin/env bash
# Orange Pi 3B / Armbian：按已保存配置（或指定 MAC）连接蓝牙设备
#
# 用法：
#   sudo ./connect.sh              # 连接配置中所有 auto_connect 设备
#   sudo ./connect.sh AA:BB:CC:DD:EE:FF
#   sudo ./connect.sh status       # 查看状态
#   sudo ./connect.sh list         # 列出已保存设备
#   sudo ./connect.sh -f           # 强制连接（含 auto_connect=false）
#
# 首次配对请用：sudo python3 bluetooth.py

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BT_PY="${SCRIPT_DIR}/bluetooth.py"
CONFIG="${BT_CONFIG:-/etc/toydairy-bluetooth/devices.json}"
USER_CONFIG="${HOME}/.config/toydairy-bluetooth/devices.json"

die() { echo "错误: $*" >&2; exit 1; }
info() { echo "$*"; }

need_root_hint() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "提示: 建议使用 sudo 运行，以便访问系统蓝牙与 /etc 配置" >&2
  fi
}

resolve_config() {
  if [[ -n "${BT_CONFIG_OVERRIDE:-}" ]]; then
    echo "$BT_CONFIG_OVERRIDE"
    return
  fi
  if [[ -f "$CONFIG" ]]; then
    echo "$CONFIG"
  elif [[ -f "$USER_CONFIG" ]]; then
    echo "$USER_CONFIG"
  else
    echo "$CONFIG"
  fi
}

ensure_deps() {
  command -v bluetoothctl >/dev/null 2>&1 || \
    die "未找到 bluetoothctl，请先: sudo apt install -y bluez bluez-tools"
  command -v python3 >/dev/null 2>&1 || die "未找到 python3"
  [[ -f "$BT_PY" ]] || die "未找到 $BT_PY"
}

ensure_bt_up() {
  if command -v systemctl >/dev/null 2>&1; then
    if ! systemctl is-active --quiet bluetooth 2>/dev/null; then
      info "启动 bluetooth 服务…"
      systemctl start bluetooth || true
      sleep 1
    fi
  fi
  bluetoothctl power on >/dev/null 2>&1 || true
  bluetoothctl agent on >/dev/null 2>&1 || true
  bluetoothctl default-agent >/dev/null 2>&1 || true
}

is_mac() {
  [[ "$1" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]
}

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \?//'
}

main() {
  local force=0
  local mac=""
  local sub=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help|help)
        usage
        exit 0
        ;;
      -f|--force)
        force=1
        shift
        ;;
      --config)
        BT_CONFIG_OVERRIDE="${2:-}"
        [[ -n "$BT_CONFIG_OVERRIDE" ]] || die "--config 需要路径"
        shift 2
        ;;
      status|list|scan)
        sub="$1"
        shift
        ;;
      -*)
        die "未知选项: $1（见 --help）"
        ;;
      *)
        if is_mac "$1"; then
          mac="$(echo "$1" | tr '[:lower:]' '[:upper:]')"
        else
          die "参数不是有效 MAC: $1（格式 AA:BB:CC:DD:EE:FF）"
        fi
        shift
        ;;
    esac
  done

  need_root_hint
  ensure_deps
  ensure_bt_up

  local cfg
  cfg="$(resolve_config)"
  local py_args=(python3 "$BT_PY" --config "$cfg")

  case "$sub" in
    status)
      exec "${py_args[@]}" status
      ;;
    list)
      exec "${py_args[@]}" list
      ;;
    scan)
      exec "${py_args[@]}" scan
      ;;
  esac

  # 默认：连接
  local connect_args=(connect)
  if [[ -n "$mac" ]]; then
    connect_args+=("$mac")
  fi
  if [[ "$force" -eq 1 ]]; then
    connect_args+=(--force)
  fi

  info "配置: $cfg"
  if [[ -n "$mac" ]]; then
    info "连接: $mac"
  else
    info "连接已保存的自动连接设备…"
  fi

  exec "${py_args[@]}" "${connect_args[@]}"
}

main "$@"
