#!/usr/bin/env python3
"""Orange Pi 3B / Armbian Trixie 蓝牙工具连接与持久化。

交互扫描并选择若干蓝牙设备，完成 pair / trust / connect，
将配置写入本机，并可选安装 systemd 服务，使下次开机后自动重连。

依赖（系统包，无需 pip）：
  sudo apt update
  sudo apt install -y bluez bluez-tools python3

用法：
  sudo python3 bluetooth.py              # 交互：扫描 → 选择 → 连接 → 持久化
  sudo python3 bluetooth.py scan         # 仅扫描
  sudo python3 bluetooth.py connect      # 按已保存配置重连
  sudo python3 bluetooth.py status       # 查看适配器与已保存设备状态
  sudo python3 bluetooth.py list         # 列出已保存设备
  sudo python3 bluetooth.py remove MAC   # 取消信任/配对并删除配置
  sudo python3 bluetooth.py install-service
  sudo python3 bluetooth.py uninstall-service
  sudo python3 bluetooth.py help
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# 路径与常量
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = Path(
    os.environ.get("BT_CONFIG", "/etc/toydairy-bluetooth/devices.json")
)
# 无 root 时回落到用户目录，便于开发预览
USER_CONFIG_FALLBACK = Path.home() / ".config" / "toydairy-bluetooth" / "devices.json"

SERVICE_NAME = "toydairy-bluetooth-autoconnect"
SERVICE_PATH = Path(f"/etc/systemd/system/{SERVICE_NAME}.service")

SCAN_SECONDS_DEFAULT = 12
CONNECT_RETRIES = 3
CONNECT_RETRY_DELAY_S = 2.0
BTCTL_TIMEOUT_S = 60


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass
class DeviceRecord:
    mac: str
    name: str = ""
    trusted: bool = True
    auto_connect: bool = True
    paired_at: str = ""
    note: str = ""

    def normalize(self) -> "DeviceRecord":
        self.mac = normalize_mac(self.mac)
        return self


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------


def eprint(*args: object, **kwargs: object) -> None:
    print(*args, file=sys.stderr, **kwargs)


def is_root() -> bool:
    try:
        return os.geteuid() == 0
    except AttributeError:
        # Windows 开发机无 geteuid
        return False


def which(cmd: str) -> str | None:
    return shutil.which(cmd)


def require_linux_bluez() -> None:
    if sys.platform.startswith("win"):
        eprint(
            "当前是 Windows 环境，本脚本面向 Armbian / Linux BlueZ。\n"
            "请把本文件拷到 Orange Pi 后执行，例如：\n"
            "  scp hardware/bluetooth/bluetooth.py root@<pi-ip>:/root/\n"
            "  ssh root@<pi-ip>\n"
            "  sudo python3 /root/bluetooth.py"
        )
        sys.exit(2)
    if not which("bluetoothctl"):
        eprint(
            "未找到 bluetoothctl。请先安装：\n"
            "  sudo apt update && sudo apt install -y bluez bluez-tools"
        )
        sys.exit(2)


def normalize_mac(mac: str) -> str:
    mac = mac.strip().upper().replace("-", ":")
    if not re.fullmatch(r"([0-9A-F]{2}:){5}[0-9A-F]{2}", mac):
        raise ValueError(f"无效 MAC 地址: {mac}")
    return mac


def run(
    cmd: list[str] | str,
    *,
    timeout: float | None = BTCTL_TIMEOUT_S,
    check: bool = False,
    input_text: str | None = None,
) -> subprocess.CompletedProcess[str]:
    if isinstance(cmd, str):
        shell = True
        args: list[str] | str = cmd
    else:
        shell = False
        args = cmd
    try:
        return subprocess.run(
            args,
            shell=shell,
            input=input_text,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=check,
        )
    except subprocess.TimeoutExpired as exc:
        eprint(f"命令超时 ({timeout}s): {cmd}")
        raise SystemExit(1) from exc


def bluetoothctl(commands: Iterable[str], *, timeout: float = BTCTL_TIMEOUT_S) -> str:
    """向 bluetoothctl 批量发送命令（非交互批处理）。"""
    script = "\n".join(commands) + "\nquit\n"
    # 使用临时脚本 + bluetoothctl -- 的 stdin，兼容 BlueZ 5.x
    proc = run(
        ["bluetoothctl"],
        timeout=timeout,
        input_text=script,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    return out


def bluetoothctl_cmd(*args: str, timeout: float = 30.0) -> subprocess.CompletedProcess[str]:
    return run(["bluetoothctl", *args], timeout=timeout)


# ---------------------------------------------------------------------------
# 配置读写
# ---------------------------------------------------------------------------


def resolve_config_path(explicit: Path | None = None) -> Path:
    if explicit is not None:
        return explicit
    if is_root() or DEFAULT_CONFIG_PATH.parent.exists():
        return DEFAULT_CONFIG_PATH
    return USER_CONFIG_FALLBACK


def load_config(path: Path) -> list[DeviceRecord]:
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        eprint(f"读取配置失败 {path}: {exc}")
        return []
    devices = raw.get("devices", raw if isinstance(raw, list) else [])
    result: list[DeviceRecord] = []
    for item in devices:
        try:
            rec = DeviceRecord(
                mac=item["mac"],
                name=item.get("name", ""),
                trusted=bool(item.get("trusted", True)),
                auto_connect=bool(item.get("auto_connect", True)),
                paired_at=item.get("paired_at", ""),
                note=item.get("note", ""),
            ).normalize()
            result.append(rec)
        except (KeyError, ValueError, TypeError) as exc:
            eprint(f"跳过无效配置项 {item!r}: {exc}")
    return result


def save_config(path: Path, devices: list[DeviceRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "devices": [asdict(d.normalize()) for d in devices],
    }
    # 原子写入
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".bt-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    try:
        os.chmod(path, 0o644)
    except OSError:
        pass
    print(f"已保存配置: {path}  ({len(devices)} 台设备)")


def upsert_device(devices: list[DeviceRecord], rec: DeviceRecord) -> list[DeviceRecord]:
    rec = rec.normalize()
    out: list[DeviceRecord] = []
    replaced = False
    for d in devices:
        if d.mac == rec.mac:
            out.append(rec)
            replaced = True
        else:
            out.append(d)
    if not replaced:
        out.append(rec)
    return out


def remove_from_config(devices: list[DeviceRecord], mac: str) -> list[DeviceRecord]:
    mac = normalize_mac(mac)
    return [d for d in devices if d.mac != mac]


# ---------------------------------------------------------------------------
# 适配器 / 扫描 / 连接
# ---------------------------------------------------------------------------


def ensure_bluetooth_service() -> None:
    if not which("systemctl"):
        return
    st = run(["systemctl", "is-active", "bluetooth"], timeout=10)
    if st.stdout.strip() != "active":
        print("启动 bluetooth 服务…")
        run(["systemctl", "start", "bluetooth"], timeout=30)
        time.sleep(1)
    # 开机自启
    en = run(["systemctl", "is-enabled", "bluetooth"], timeout=10)
    if en.stdout.strip() not in ("enabled", "static", "indirect", "alias", "enabled-runtime"):
        print("设置 bluetooth 开机自启…")
        run(["systemctl", "enable", "bluetooth"], timeout=30)


def power_on_adapter() -> None:
    bluetoothctl(
        [
            "power on",
            "agent on",
            "default-agent",
            "pairable on",
            "discoverable off",
        ],
        timeout=20,
    )


def parse_device_lines(text: str) -> dict[str, str]:
    """从 bluetoothctl 输出解析 MAC -> 名称。"""
    devices: dict[str, str] = {}
    # Device AA:BB:CC:DD:EE:FF Name here
    for line in text.splitlines():
        m = re.search(
            r"Device\s+([0-9A-Fa-f:]{17})\s+(.*)$",
            line.strip(),
        )
        if m:
            mac = normalize_mac(m.group(1))
            name = m.group(2).strip() or "(unknown)"
            devices[mac] = name
    return devices


def scan_devices(seconds: int = SCAN_SECONDS_DEFAULT) -> dict[str, str]:
    print(f"扫描蓝牙设备 {seconds}s …（请确保设备已开机且处于可发现状态）")
    # 先清一次扫描状态
    bluetoothctl(["scan off"], timeout=10)
    # 启动扫描
    start = run(
        ["bluetoothctl", "--timeout", str(seconds), "scan", "on"],
        timeout=seconds + 15,
    )
    # 扫描结束后再拉一次已发现列表
    listed = bluetoothctl_cmd("devices", timeout=15)
    text = (start.stdout or "") + (start.stderr or "") + (listed.stdout or "")
    devices = parse_device_lines(text)
    # 补充 devices.paired / devices.trusted 里已有的
    for sub in ("devices",):
        p = bluetoothctl_cmd(sub, timeout=10)
        devices.update(parse_device_lines(p.stdout or ""))
    return devices


def get_device_info(mac: str) -> str:
    p = bluetoothctl_cmd("info", mac, timeout=15)
    return (p.stdout or "") + (p.stderr or "")


def is_connected(mac: str) -> bool:
    info = get_device_info(mac)
    return bool(re.search(r"Connected:\s*yes", info, re.I))


def is_paired(mac: str) -> bool:
    info = get_device_info(mac)
    return bool(re.search(r"Paired:\s*yes", info, re.I))


def is_trusted(mac: str) -> bool:
    info = get_device_info(mac)
    return bool(re.search(r"Trusted:\s*yes", info, re.I))


def pair_trust_connect(mac: str, name: str = "") -> bool:
    mac = normalize_mac(mac)
    label = f"{name} [{mac}]" if name else mac
    print(f"\n>>> 处理设备: {label}")

    # 部分 BLE 设备需要先 connect 再 pair
    bluetoothctl([f"connect {mac}"], timeout=25)
    time.sleep(0.5)

    if not is_paired(mac):
        print("  配对中…")
        out = bluetoothctl(
            [
                "agent on",
                "default-agent",
                f"pair {mac}",
            ],
            timeout=45,
        )
        if re.search(r"Failed to pair|AuthenticationFailed|org\.bluez\.Error", out, re.I):
            # 再试一次：部分耳机/音箱要先 remove 再 pair
            eprint("  首次配对可能失败，尝试 remove 后重试…")
            bluetoothctl([f"remove {mac}"], timeout=15)
            time.sleep(1)
            out = bluetoothctl(
                [
                    "agent on",
                    "default-agent",
                    f"pair {mac}",
                ],
                timeout=45,
            )
        if not is_paired(mac):
            # 有些设备不支持经典 pair，仅 connect 即可
            eprint("  警告: 未确认 Paired=yes，继续尝试 trust/connect")
        else:
            print("  已配对")
    else:
        print("  已配对（跳过）")

    print("  设置信任（trust）…")
    bluetoothctl([f"trust {mac}"], timeout=15)
    if is_trusted(mac):
        print("  已信任")
    else:
        eprint("  警告: Trusted 未确认")

    ok = False
    for attempt in range(1, CONNECT_RETRIES + 1):
        print(f"  连接中… ({attempt}/{CONNECT_RETRIES})")
        bluetoothctl([f"connect {mac}"], timeout=30)
        time.sleep(1.0)
        if is_connected(mac):
            ok = True
            break
        time.sleep(CONNECT_RETRY_DELAY_S)

    if ok:
        print(f"  ✓ 已连接: {label}")
    else:
        eprint(f"  ✗ 连接失败: {label}")
        eprint("    可稍后执行: sudo python3 bluetooth.py connect")
    return ok


def disconnect_device(mac: str) -> None:
    bluetoothctl([f"disconnect {normalize_mac(mac)}"], timeout=20)


def remove_device_system(mac: str) -> None:
    mac = normalize_mac(mac)
    bluetoothctl([f"disconnect {mac}", f"untrust {mac}", f"remove {mac}"], timeout=30)


# ---------------------------------------------------------------------------
# 交互选择
# ---------------------------------------------------------------------------


def print_device_table(devices: dict[str, str], saved: set[str] | None = None) -> list[str]:
    """打印表格，返回按序号排列的 mac 列表。"""
    saved = saved or set()
    macs = sorted(devices.keys(), key=lambda m: (devices[m].lower(), m))
    if not macs:
        print("（未发现设备）")
        return []
    print()
    print(f"{'#':>3}  {'MAC':<17}  {'已保存':^6}  名称")
    print("-" * 60)
    for i, mac in enumerate(macs, 1):
        flag = "yes" if mac in saved else ""
        print(f"{i:>3}  {mac:<17}  {flag:^6}  {devices[mac]}")
    print()
    return macs


def parse_selection(text: str, count: int) -> list[int]:
    """解析 '1 3 5' / '1,3-5' / 'all'。"""
    text = text.strip().lower()
    if not text:
        return []
    if text in ("all", "a", "*"):
        return list(range(1, count + 1))
    indices: set[int] = set()
    for part in re.split(r"[,\s]+", text):
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
            if start > end:
                start, end = end, start
            for n in range(start, end + 1):
                indices.add(n)
        else:
            indices.add(int(part))
    bad = [n for n in indices if n < 1 or n > count]
    if bad:
        raise ValueError(f"序号超出范围: {bad}（有效 1–{count}）")
    return sorted(indices)


def interactive_select(devices: dict[str, str], saved_macs: set[str]) -> list[tuple[str, str]]:
    macs = print_device_table(devices, saved_macs)
    if not macs:
        return []
    print("请选择要连接的设备（可多选）。")
    print("  示例: 1 3   或  1,2,5   或  2-4   或  all")
    print("  直接回车 = 取消")
    while True:
        try:
            raw = input("选择 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return []
        if not raw:
            return []
        try:
            idxs = parse_selection(raw, len(macs))
        except ValueError as exc:
            eprint(f"输入无效: {exc}")
            continue
        if not idxs:
            eprint("未选择任何设备")
            continue
        return [(macs[i - 1], devices[macs[i - 1]]) for i in idxs]


def prompt_yes_no(msg: str, default: bool = True) -> bool:
    hint = "Y/n" if default else "y/N"
    try:
        raw = input(f"{msg} [{hint}] ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    if not raw:
        return default
    return raw in ("y", "yes", "是", "1")


# ---------------------------------------------------------------------------
# systemd 开机自动连接
# ---------------------------------------------------------------------------


def service_unit_content(script_path: Path, config_path: Path) -> str:
    python = which("python3") or "/usr/bin/python3"
    return f"""[Unit]
Description=ToyDairy Bluetooth auto-connect (trusted devices)
After=bluetooth.service network.target
Wants=bluetooth.service
# 等待适配器就绪
StartLimitIntervalSec=0

[Service]
Type=oneshot
RemainAfterExit=yes
# 开机后稍等 BlueZ 与固件
ExecStartPre=/bin/sleep 5
ExecStart={python} {script_path} connect --config {config_path} --quiet-ok
# 断线后不自动无限重试；由 BlueZ trust + 本服务开机拉一次
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""


def install_service(config_path: Path) -> None:
    if not is_root():
        eprint("安装 systemd 服务需要 root：sudo python3 bluetooth.py install-service")
        sys.exit(1)
    if not which("systemctl"):
        eprint("未找到 systemctl，无法安装服务")
        sys.exit(1)

    script_path = Path(__file__).resolve()
    # 复制脚本到系统路径，避免 U 盘路径变动
    install_dir = Path("/usr/local/lib/toydairy-bluetooth")
    install_dir.mkdir(parents=True, exist_ok=True)
    target_script = install_dir / "bluetooth.py"
    shutil.copy2(script_path, target_script)
    os.chmod(target_script, 0o755)

    unit = service_unit_content(target_script, config_path)
    SERVICE_PATH.write_text(unit, encoding="utf-8")
    run(["systemctl", "daemon-reload"], timeout=30)
    run(["systemctl", "enable", SERVICE_NAME], timeout=30)
    print(f"已安装并 enable 服务: {SERVICE_PATH}")
    print(f"  脚本: {target_script}")
    print(f"  配置: {config_path}")
    print(f"查看日志: journalctl -u {SERVICE_NAME} -b")
    print(f"立即执行: systemctl start {SERVICE_NAME}")


def uninstall_service() -> None:
    if not is_root():
        eprint("需要 root：sudo python3 bluetooth.py uninstall-service")
        sys.exit(1)
    if which("systemctl"):
        run(["systemctl", "disable", "--now", SERVICE_NAME], timeout=30)
        run(["systemctl", "daemon-reload"], timeout=30)
    if SERVICE_PATH.exists():
        SERVICE_PATH.unlink()
        print(f"已删除 {SERVICE_PATH}")
    else:
        print("服务单元不存在，跳过")


# ---------------------------------------------------------------------------
# 子命令
# ---------------------------------------------------------------------------


def cmd_scan(args: argparse.Namespace) -> int:
    require_linux_bluez()
    ensure_bluetooth_service()
    power_on_adapter()
    devices = scan_devices(args.seconds)
    saved = {d.mac for d in load_config(resolve_config_path(args.config))}
    print_device_table(devices, saved)
    print(f"共 {len(devices)} 台")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    require_linux_bluez()
    ensure_bluetooth_service()
    power_on_adapter()

    print("== 适配器 ==")
    show = bluetoothctl_cmd("show", timeout=15)
    print((show.stdout or show.stderr or "").strip() or "(无输出)")

    cfg_path = resolve_config_path(args.config)
    devices = load_config(cfg_path)
    print(f"\n== 已保存设备 ({cfg_path}) ==")
    if not devices:
        print("（无）")
        return 0
    for d in devices:
        conn = "connected" if is_connected(d.mac) else "offline"
        pair = "paired" if is_paired(d.mac) else "not-paired"
        trust = "trusted" if is_trusted(d.mac) else "not-trusted"
        print(f"  {d.mac}  {d.name or '-'}")
        print(f"    auto={d.auto_connect}  {pair}  {trust}  {conn}")
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    cfg_path = resolve_config_path(args.config)
    devices = load_config(cfg_path)
    print(f"配置文件: {cfg_path}")
    if not devices:
        print("（无已保存设备）")
        return 0
    for d in devices:
        print(f"  {d.mac}  {d.name}  auto_connect={d.auto_connect}")
    return 0


def cmd_connect(args: argparse.Namespace) -> int:
    require_linux_bluez()
    ensure_bluetooth_service()
    power_on_adapter()
    cfg_path = resolve_config_path(args.config)
    devices = load_config(cfg_path)
    if not devices:
        eprint(f"配置为空: {cfg_path}")
        eprint("请先运行: sudo python3 bluetooth.py")
        return 1

    targets = devices
    if args.mac:
        mac = normalize_mac(args.mac)
        targets = [d for d in devices if d.mac == mac]
        if not targets:
            eprint(f"配置中无此 MAC: {mac}")
            return 1

    ok_n = 0
    for d in targets:
        if not d.auto_connect and not args.force:
            if not getattr(args, "quiet_ok", False):
                print(f"跳过（auto_connect=false）: {d.mac} {d.name}")
            continue
        if is_connected(d.mac):
            if not getattr(args, "quiet_ok", False):
                print(f"已连接: {d.mac} {d.name}")
            ok_n += 1
            continue
        if pair_trust_connect(d.mac, d.name):
            ok_n += 1

    if ok_n == 0:
        return 1
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    require_linux_bluez()
    mac = normalize_mac(args.mac)
    cfg_path = resolve_config_path(args.config)
    devices = load_config(cfg_path)
    print(f"移除系统配对/信任: {mac}")
    remove_device_system(mac)
    devices = remove_from_config(devices, mac)
    save_config(cfg_path, devices)
    return 0


def cmd_install_service(args: argparse.Namespace) -> int:
    cfg_path = resolve_config_path(args.config)
    # 确保配置目录存在
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    if not cfg_path.exists():
        save_config(cfg_path, [])
    install_service(cfg_path)
    return 0


def cmd_uninstall_service(_args: argparse.Namespace) -> int:
    uninstall_service()
    return 0


def cmd_setup(args: argparse.Namespace) -> int:
    """默认交互流程：扫描 → 选择 → 连接 → 保存 → 可选装服务。"""
    require_linux_bluez()
    if not is_root():
        eprint("建议使用 root 运行以便写入 /etc 与安装 systemd 服务：")
        eprint("  sudo python3 bluetooth.py")
        if not prompt_yes_no("仍以当前用户继续（配置写入 ~/.config）？", default=False):
            return 1

    ensure_bluetooth_service()
    power_on_adapter()

    cfg_path = resolve_config_path(args.config)
    saved = load_config(cfg_path)
    saved_macs = {d.mac for d in saved}

    devices = scan_devices(args.seconds)
    if not devices and saved:
        print("扫描未发现新设备，展示已保存设备供重连选择…")
        devices = {d.mac: d.name or d.mac for d in saved}

    selected = interactive_select(devices, saved_macs)
    if not selected:
        print("未选择设备，退出。")
        return 0

    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    success = 0
    for mac, name in selected:
        if pair_trust_connect(mac, name):
            success += 1
        rec = DeviceRecord(
            mac=mac,
            name=name,
            trusted=True,
            auto_connect=True,
            paired_at=now,
        )
        saved = upsert_device(saved, rec)

    save_config(cfg_path, saved)
    print(f"\n连接成功 {success}/{len(selected)}")

    # 持久化：trust 已由 BlueZ 写入 /var/lib/bluetooth
    # 再装 systemd 以便开机主动 connect
    if is_root() and which("systemctl"):
        if args.yes or prompt_yes_no("安装开机自动连接 systemd 服务？", default=True):
            install_service(cfg_path)
            run(["systemctl", "start", SERVICE_NAME], timeout=60)
    else:
        print(
            "\n提示: 使用 root 运行下列命令可安装开机自连服务：\n"
            f"  sudo python3 {Path(__file__).resolve()} install-service"
        )

    print(
        "\n完成。BlueZ 已 trust 设备；下次设备上电后通常会自动回连。\n"
        "手动重连: sudo python3 bluetooth.py connect\n"
        "查看状态: sudo python3 bluetooth.py status"
    )
    return 0 if success else 1


def cmd_help(_args: argparse.Namespace) -> int:
    print(__doc__)
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Armbian 蓝牙设备选择连接与开机自动重连",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="默认无子命令时进入交互 setup。",
    )
    p.add_argument(
        "--config",
        type=Path,
        default=None,
        help=f"配置文件路径（默认 {DEFAULT_CONFIG_PATH} 或 ~/.config/...）",
    )
    p.add_argument(
        "--seconds",
        type=int,
        default=SCAN_SECONDS_DEFAULT,
        help=f"扫描秒数（默认 {SCAN_SECONDS_DEFAULT}）",
    )
    p.add_argument("-y", "--yes", action="store_true", help="对确认项默认 yes")

    sub = p.add_subparsers(dest="command")

    sp = sub.add_parser("scan", help="扫描并列出设备")
    sp.set_defaults(func=cmd_scan)

    sp = sub.add_parser("status", help="适配器与已保存设备状态")
    sp.set_defaults(func=cmd_status)

    sp = sub.add_parser("list", help="列出已保存配置")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("connect", help="按配置重连")
    sp.add_argument("mac", nargs="?", help="只连接指定 MAC")
    sp.add_argument("--force", action="store_true", help="忽略 auto_connect=false")
    sp.add_argument(
        "--quiet-ok",
        action="store_true",
        help="已连接时少打日志（供 systemd 使用）",
    )
    sp.set_defaults(func=cmd_connect)

    sp = sub.add_parser("remove", help="取消配对并删除配置")
    sp.add_argument("mac", help="设备 MAC")
    sp.set_defaults(func=cmd_remove)

    sp = sub.add_parser("install-service", help="安装开机自动连接服务")
    sp.set_defaults(func=cmd_install_service)

    sp = sub.add_parser("uninstall-service", help="卸载开机自动连接服务")
    sp.set_defaults(func=cmd_uninstall_service)

    sp = sub.add_parser("setup", help="交互扫描连接（默认）")
    sp.set_defaults(func=cmd_setup)

    sp = sub.add_parser("help", help="显示说明")
    sp.set_defaults(func=cmd_help)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    # 无子命令 → setup
    if not args.command:
        args.command = "setup"
        args.func = cmd_setup
    try:
        return int(args.func(args))
    except KeyboardInterrupt:
        print("\n已中断")
        return 130
    except ValueError as exc:
        eprint(f"错误: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
