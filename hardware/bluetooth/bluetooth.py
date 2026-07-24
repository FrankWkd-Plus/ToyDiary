#!/usr/bin/env python3
"""Orange Pi 3B / Armbian Trixie 蓝牙工具连接与持久化。

交互扫描并选择若干蓝牙设备，完成 pair / trust / connect，
将配置写入本机，并可选安装 systemd 服务，使下次开机后自动重连。

身份标识：
  每台设备以唯一 MAC 地址记忆与连接；名称（如 ring）仅作显示。
  环境中有多台同名 ring 时，不会按名称猜测或改绑 MAC。

依赖（系统包，无需 pip）：
  sudo apt update
  sudo apt install -y bluez bluez-tools python3
  # 耳机 A2DP 另需：
  # sudo apt install -y bluez-alsa-utils libasound2-plugin-bluez

用法：
  sudo python3 bluetooth.py              # 交互：扫描 → 选择 → 连接 → 持久化
  sudo python3 bluetooth.py scan         # 仅扫描
  sudo python3 bluetooth.py connect      # 按已保存 MAC 重连（会先扫描刷新）
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
import threading
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
USER_CONFIG_FALLBACK = Path.home() / ".config" / "toydairy-bluetooth" / "devices.json"

SERVICE_NAME = "toydairy-bluetooth-autoconnect"
SERVICE_PATH = Path(f"/etc/systemd/system/{SERVICE_NAME}.service")

SCAN_SECONDS_DEFAULT = 15
REDISCOVER_SECONDS = 20
CONNECT_RETRIES = 4
CONNECT_RETRY_DELAY_S = 2.0
BTCTL_TIMEOUT_S = 90
PAIR_TIMEOUT_S = 60


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
        return False


def which(cmd: str) -> str | None:
    return shutil.which(cmd)


def require_linux_bluez() -> None:
    if sys.platform.startswith("win"):
        eprint(
            "当前是 Windows 环境，本脚本面向 Armbian / Linux BlueZ。\n"
            "请把本文件拷到 Orange Pi 后执行，例如：\n"
            "  scp hardware/bluetooth/bluetooth.py root@<pi-ip>:/home/blt/\n"
            "  ssh -p 19198 root@<pi-ip>\n"
            "  sudo python3 /home/blt/bluetooth.py"
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


def strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", text)


# ---------------------------------------------------------------------------
# bluetoothctl 会话（保持 agent，避免 "No agent is registered"）
# ---------------------------------------------------------------------------


class BtSession:
    """长生命周期 bluetoothctl 交互会话。"""

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            ["bluetoothctl"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self._buf: list[str] = []
        self._lock = threading.Lock()
        self._alive = True
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        time.sleep(0.3)

    def _read_loop(self) -> None:
        assert self.proc.stdout is not None
        try:
            for line in self.proc.stdout:
                with self._lock:
                    self._buf.append(line)
        except Exception:
            pass
        finally:
            self._alive = False

    def send(self, cmd: str) -> None:
        if not self._alive or self.proc.stdin is None:
            raise RuntimeError("bluetoothctl 会话已结束")
        self.proc.stdin.write(cmd + "\n")
        self.proc.stdin.flush()

    def drain(self) -> str:
        with self._lock:
            text = "".join(self._buf)
            self._buf.clear()
        return text

    def expect_idle(self, settle: float = 0.8, max_wait: float = 8.0) -> str:
        """等待输出暂时停顿后返回累计文本。"""
        chunks: list[str] = []
        end = time.time() + max_wait
        last_data = time.time()
        while time.time() < end:
            piece = self.drain()
            if piece:
                chunks.append(piece)
                last_data = time.time()
            elif time.time() - last_data >= settle:
                break
            time.sleep(0.1)
        chunks.append(self.drain())
        return strip_ansi("".join(chunks))

    def cmd(self, command: str, wait: float = 1.2) -> str:
        self.drain()
        self.send(command)
        time.sleep(wait)
        return self.expect_idle(settle=0.5, max_wait=max(wait + 2.0, 4.0))

    def close(self) -> None:
        try:
            if self._alive and self.proc.stdin:
                self.send("quit")
        except Exception:
            pass
        try:
            self.proc.terminate()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=3)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass


def bluetoothctl(commands: Iterable[str], *, timeout: float = BTCTL_TIMEOUT_S) -> str:
    """向一次性 bluetoothctl 批量发送命令。"""
    script = "\n".join(commands) + "\nquit\n"
    proc = run(["bluetoothctl"], timeout=timeout, input_text=script)
    return strip_ansi((proc.stdout or "") + (proc.stderr or ""))


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


def replace_mac_in_config(
    devices: list[DeviceRecord], old_mac: str, new_mac: str, name: str = ""
) -> list[DeviceRecord]:
    old_mac = normalize_mac(old_mac)
    new_mac = normalize_mac(new_mac)
    out: list[DeviceRecord] = []
    for d in devices:
        if d.mac == old_mac:
            d.mac = new_mac
            if name:
                d.name = name
            out.append(d)
        elif d.mac == new_mac:
            # 合并重复
            continue
        else:
            out.append(d)
    return out


# ---------------------------------------------------------------------------
# 适配器 / 扫描 / 连接
# ---------------------------------------------------------------------------



def ensure_audio_profiles() -> None:
    """Ensure A2DP/HFP endpoints exist (needed for headsets like MINISO)."""
    if not which("systemctl"):
        return
    # bluealsa provides MediaEndpoint; without it connect fails with
    # br-connection-profile-unavailable for audio-headset devices.
    for unit in ("bluealsa", "bluealsa.service"):
        st = run(["systemctl", "is-active", unit], timeout=10)
        if st.stdout.strip() == "active":
            return
    for unit in ("bluealsa", "bluealsa.service"):
        r = run(["systemctl", "start", unit], timeout=20)
        if r.returncode == 0:
            time.sleep(1.0)
            st = run(["systemctl", "is-active", unit], timeout=10)
            if st.stdout.strip() == "active":
                print("已启动 bluealsa（A2DP 音频后端）")
                return
    if not which("bluealsa"):
        eprint(
            "警告: 未安装 bluealsa。耳机类设备连接会报 profile-unavailable。\n"
            "  安装: sudo apt install -y bluez-alsa-utils libasound2-plugin-bluez\n"
            "  启动: sudo systemctl enable --now bluealsa"
        )
    else:
        eprint("警告: bluealsa 未能启动，耳机 A2DP 可能不可用")


def ensure_bluetooth_service() -> None:
    if not which("systemctl"):
        return
    st = run(["systemctl", "is-active", "bluetooth"], timeout=10)
    if st.stdout.strip() != "active":
        print("启动 bluetooth 服务…")
        run(["systemctl", "start", "bluetooth"], timeout=30)
        time.sleep(1)
    en = run(["systemctl", "is-enabled", "bluetooth"], timeout=10)
    if en.stdout.strip() not in (
        "enabled",
        "static",
        "indirect",
        "alias",
        "enabled-runtime",
    ):
        print("设置 bluetooth 开机自启…")
        run(["systemctl", "enable", "bluetooth"], timeout=30)


def power_on_adapter() -> None:
    # 一次性命令足够 power/pairable；agent 在长会话里注册
    ensure_audio_profiles()
    bluetoothctl(
        [
            "power on",
            "pairable on",
            "discoverable off",
        ],
        timeout=20,
    )
    # 额外确保
    bluetoothctl_cmd("power", "on", timeout=10)
    bluetoothctl_cmd("pairable", "on", timeout=10)


def parse_device_lines(text: str) -> dict[str, str]:
    devices: dict[str, str] = {}
    text = strip_ansi(text)
    for line in text.splitlines():
        m = re.search(r"Device\s+([0-9A-Fa-f:]{17})\s+(.*)$", line.strip())
        if m:
            mac = normalize_mac(m.group(1))
            name = m.group(2).strip() or "(unknown)"
            # 去掉可能的颜色残留 / 控制符
            name = re.sub(r"\s+", " ", name).strip()
            devices[mac] = name
    return devices


def list_known_devices() -> dict[str, str]:
    listed = bluetoothctl_cmd("devices", timeout=15)
    return parse_device_lines((listed.stdout or "") + (listed.stderr or ""))


def scan_devices(seconds: int = SCAN_SECONDS_DEFAULT) -> dict[str, str]:
    print(f"扫描蓝牙设备 {seconds}s …（请确保目标设备已开机且可被发现）")
    bluetoothctl(["scan off"], timeout=10)
    start = run(
        ["bluetoothctl", "--timeout", str(seconds), "scan", "on"],
        timeout=seconds + 20,
    )
    listed = bluetoothctl_cmd("devices", timeout=15)
    text = (start.stdout or "") + (start.stderr or "") + (listed.stdout or "")
    devices = parse_device_lines(text)
    devices.update(list_known_devices())
    warn_duplicate_names(devices)
    return devices


def get_device_info(mac: str) -> str:
    p = bluetoothctl_cmd("info", mac, timeout=15)
    return strip_ansi((p.stdout or "") + (p.stderr or ""))


def device_available(mac: str) -> bool:
    info = get_device_info(mac)
    if re.search(r"not available|No default controller", info, re.I):
        return False
    return bool(re.search(r"Device\s+" + re.escape(mac), info, re.I)) or bool(
        re.search(r"Name:|Alias:|Paired:|Connected:", info, re.I)
    )


def is_connected(mac: str) -> bool:
    if not device_available(mac):
        return False
    return bool(re.search(r"Connected:\s*yes", get_device_info(mac), re.I))


def is_paired(mac: str) -> bool:
    if not device_available(mac):
        return False
    return bool(re.search(r"Paired:\s*yes", get_device_info(mac), re.I))


def is_trusted(mac: str) -> bool:
    if not device_available(mac):
        return False
    return bool(re.search(r"Trusted:\s*yes", get_device_info(mac), re.I))


def warn_duplicate_names(devices: dict[str, str]) -> None:
    """扫描结果里若多名同名设备，提示必须以 MAC 区分。"""
    by_name: dict[str, list[str]] = {}
    for mac, name in devices.items():
        key = (name or "").strip().lower() or "(unknown)"
        by_name.setdefault(key, []).append(mac)
    dups = {n: macs for n, macs in by_name.items() if len(macs) > 1 and n != "(unknown)"}
    if not dups:
        return
    eprint("注意: 扫描到重名设备，配置/连接仅以 MAC 为唯一标识，不会按名称猜测：")
    for n, macs in sorted(dups.items()):
        eprint(f"  名称 {n!r}:")
        for m in macs:
            eprint(f"    - {m}")


def rediscover_device(
    mac: str,
    name: str = "",
    seconds: int = REDISCOVER_SECONDS,
) -> tuple[str, str]:
    """仅按唯一 MAC 重新扫描发现设备。

    名称只用于显示，绝不作为身份匹配键（多台 ring 同名时必须靠 MAC）。
    返回 (mac, resolved_name)。找不到则仍返回原 mac。
    """
    mac = normalize_mac(mac)
    label = f"{name} [{mac}]" if name else mac
    print(f"  设备未在缓存中，按 MAC 扫描 {seconds}s 以重新发现 {label} …")

    known = list_known_devices()
    if mac in known:
        return mac, known[mac] or name

    # 扫描期间若看到其它同名设备，仅提示，不切换目标 MAC
    same_name_seen: set[str] = set()

    session = BtSession()
    try:
        session.cmd("power on", wait=0.5)
        session.cmd("pairable on", wait=0.3)
        session.cmd("agent NoInputNoOutput", wait=0.4)
        session.cmd("default-agent", wait=0.4)
        session.cmd("scan on", wait=0.5)

        deadline = time.time() + seconds
        found_name = ""
        while time.time() < deadline:
            out = session.expect_idle(settle=0.4, max_wait=2.0)
            for m in re.finditer(
                r"Device\s+([0-9A-Fa-f:]{17})\s+(.+)", strip_ansi(out)
            ):
                dm = normalize_mac(m.group(1))
                dn = m.group(2).strip()
                if dm == mac:
                    found_name = dn
                    break
                if name and dn.strip().lower() == name.strip().lower() and dm != mac:
                    same_name_seen.add(dm)
            if found_name:
                break

            session.send("devices")
            time.sleep(0.8)
            listing = session.expect_idle(settle=0.3, max_wait=2.0)
            devices = parse_device_lines(listing)
            if mac in devices:
                found_name = devices[mac]
                break
            if name:
                for k, v in devices.items():
                    if v.strip().lower() == name.strip().lower() and k != mac:
                        same_name_seen.add(k)

        session.cmd("scan off", wait=0.5)
    finally:
        session.close()

    devices = list_known_devices()
    if not found_name and mac in devices:
        found_name = devices[mac]

    if mac in devices or found_name:
        print(f"  已按 MAC 重新发现: {found_name or name or mac} [{mac}]")
        if same_name_seen:
            eprint(
                f"  提示: 同时看到 {len(same_name_seen)} 台同名设备，"
                f"已忽略它们，只连接配置中的 MAC {mac}"
            )
            for other in sorted(same_name_seen):
                eprint(f"    忽略: {other}")
        return mac, found_name or name

    eprint(f"  扫描结束仍未发现 MAC: {mac}" + (f" ({name})" if name else ""))
    if same_name_seen:
        eprint("  附近有同名但不同 MAC 的设备（未自动改绑，避免连错 ring）：")
        for other in sorted(same_name_seen):
            eprint(f"    {other}")
        eprint("  若确需换绑，请重新运行交互 setup 并选择正确 MAC")
    else:
        eprint("  请确认设备已开机、靠近板子，且未连在手机等其它主机上")
    return mac, name


def pair_trust_connect(
    mac: str,
    name: str = "",
    *,
    allow_name_rediscover: bool = False,
) -> tuple[bool, str, str]:
    """配对/信任/连接。身份键始终为 MAC；name 仅显示用。

    allow_name_rediscover 已废弃（保留参数兼容旧调用），不会按名称改 MAC。
    返回 (ok, mac, resolved_name)。
    """
    del allow_name_rediscover  # 明确忽略：禁止按名称切换目标
    original_mac = normalize_mac(mac)
    mac = original_mac
    label = f"{name} [{mac}]" if name else mac
    print(f"\n>>> 处理设备: {label}")

    power_on_adapter()

    if not device_available(mac):
        mac, name = rediscover_device(mac, name)
        label = f"{name} [{mac}]" if name else mac
        # rediscover 只刷新缓存，不得改变 MAC
        if mac != original_mac:
            eprint(f"  内部错误: MAC 被改写 {original_mac} -> {mac}，已强制还原")
            mac = original_mac
        if not device_available(mac):
            eprint(f"  [X] BlueZ 中无此设备对象: {label}")
            eprint("      原因: Device not available（未扫描到该 MAC / 未开机）")
            eprint("      身份仅认 MAC，不会用同名 ring 顶替")
            return False, mac, name

    session = BtSession()
    try:
        session.cmd("power on", wait=0.4)
        session.cmd("pairable on", wait=0.3)
        # NoInputNoOutput 适合音箱/戒指等无 PIN 场景；失败再试 on
        out_agent = session.cmd("agent NoInputNoOutput", wait=0.5)
        if re.search(r"Failed|error|AlreadyExists", out_agent, re.I):
            session.cmd("agent off", wait=0.2)
            session.cmd("agent on", wait=0.4)
        session.cmd("default-agent", wait=0.4)

        # BLE 常见路径：先 connect 再建键；经典耳机则 pair 更关键
        print("  尝试连接…")
        out = session.cmd(f"connect {mac}", wait=3.0)
        # 等链路稳定
        time.sleep(1.5)

        if not is_paired(mac):
            print("  配对中…")
            out = session.cmd(f"pair {mac}", wait=4.0)
            # pair 可能异步
            deadline = time.time() + PAIR_TIMEOUT_S
            while time.time() < deadline and not is_paired(mac):
                more = session.expect_idle(settle=0.5, max_wait=2.0)
                out += more
                if re.search(
                    r"Failed to pair|AuthenticationFailed|Authentication Rejected|"
                    r"org\.bluez\.Error\.(Authentication|Failed|AlreadyExists)",
                    out,
                    re.I,
                ):
                    break
                if re.search(r"Pairing successful|Paired:\s*yes", out, re.I):
                    break
                time.sleep(0.8)

            if not is_paired(mac):
                eprint("  配对未确认，尝试 remove 后重来…")
                session.cmd(f"remove {mac}", wait=1.0)
                time.sleep(1.0)
                # remove 后需再发现（仍只认原 MAC）
                session.cmd("scan on", wait=0.3)
                time.sleep(3.0)
                session.cmd("scan off", wait=0.3)
                if not device_available(mac):
                    session.close()
                    mac, name = rediscover_device(original_mac, name)
                    mac = original_mac
                    session = BtSession()
                    session.cmd("power on", wait=0.3)
                    session.cmd("pairable on", wait=0.3)
                    session.cmd("agent NoInputNoOutput", wait=0.4)
                    session.cmd("default-agent", wait=0.3)
                session.cmd(f"pair {mac}", wait=5.0)
                time.sleep(2.0)

            if is_paired(mac):
                print("  已配对")
            else:
                eprint("  警告: 未确认 Paired=yes（部分 BLE 仅需 connect）")
        else:
            print("  已配对（跳过）")

        print("  设置信任（trust）…")
        session.cmd(f"trust {mac}", wait=1.0)
        if is_trusted(mac):
            print("  已信任")
        else:
            # 再试一次非会话命令
            bluetoothctl_cmd("trust", mac, timeout=15)
            if is_trusted(mac):
                print("  已信任")
            else:
                eprint("  警告: Trusted 未确认")

        ok = False
        for attempt in range(1, CONNECT_RETRIES + 1):
            if is_connected(mac):
                ok = True
                break
            print(f"  连接中… ({attempt}/{CONNECT_RETRIES})")
            cout = session.cmd(f"connect {mac}", wait=3.0)
            time.sleep(1.2)
            if is_connected(mac):
                ok = True
                break
            if re.search(r"profile-unavailable", cout, re.I):
                eprint("  检测到 profile-unavailable，重启 bluealsa 后重试…")
                if which("systemctl"):
                    run(["systemctl", "restart", "bluealsa"], timeout=20)
                    time.sleep(1.5)
                    ensure_audio_profiles()
            if re.search(r"Connection refused|br-connection-page-timeout|"
                         r"br-connection-timeout|Failed to connect|"
                         r"le-connection-abort-by-local|Input/output error|"
                         r"profile-unavailable",
                         cout, re.I):
                eprint(f"  connect 输出异常片段: {cout.strip()[-200:]}")
            time.sleep(CONNECT_RETRY_DELAY_S)

        if ok:
            print(f"  [OK] 已连接: {name or ''} [{mac}]".strip())
        else:
            info = get_device_info(mac)
            eprint(f"  [X] 连接失败: {name or ''} [{mac}]".strip())
            eprint("  诊断 info:")
            for line in info.splitlines()[:25]:
                eprint(f"    {line}")
            eprint("  常见原因:")
            eprint("    - 设备已连到手机/其它主机（请断开后重试）")
            eprint("    - 设备休眠/关机，或不在可发现模式")
            eprint("    - BLE 随机地址变化：请重新 scan 并用新 MAC setup")
            eprint("    - 耳机需在配对模式（常按 3–5 秒）")
            eprint("    - audio-headset 报 profile-unavailable: 需 bluealsa/A2DP 后端")
            eprint("      sudo apt install -y bluez-alsa-utils && sudo systemctl enable --now bluealsa")
        return ok, mac, name
    finally:
        try:
            session.close()
        except Exception:
            pass


def disconnect_device(mac: str) -> None:
    bluetoothctl([f"disconnect {normalize_mac(mac)}"], timeout=20)


def remove_device_system(mac: str) -> None:
    mac = normalize_mac(mac)
    bluetoothctl([f"disconnect {mac}", f"untrust {mac}", f"remove {mac}"], timeout=30)


# ---------------------------------------------------------------------------
# 交互选择
# ---------------------------------------------------------------------------


def print_device_table(devices: dict[str, str], saved: set[str] | None = None) -> list[str]:
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
    # --config 在子命令 connect 之前；二次重试用 timer，避免 ExecStartPost 卡很久
    return f"""[Unit]
Description=ToyDairy Bluetooth auto-connect (trusted devices)
Documentation=file://{script_path}
After=bluetooth.service network-online.target bluealsa.service
Wants=bluetooth.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/bin/sleep 12
ExecStart={python} {script_path} --config {config_path} connect --quiet-ok
StandardOutput=journal
StandardError=journal
SuccessExitStatus=0 1

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
    install_dir = Path("/usr/local/lib/toydairy-bluetooth")
    install_dir.mkdir(parents=True, exist_ok=True)
    target_script = install_dir / "bluetooth.py"
    shutil.copy2(script_path, target_script)
    os.chmod(target_script, 0o755)

    unit = service_unit_content(target_script, config_path)
    SERVICE_PATH.write_text(unit, encoding="utf-8")
    timer_path = Path(f"/etc/systemd/system/{SERVICE_NAME}.timer")
    timer_path.write_text(
        f"""[Unit]
Description=Retry {SERVICE_NAME} after boot
After={SERVICE_NAME}.service

[Timer]
OnBootSec=2min
AccuracySec=15s
Unit={SERVICE_NAME}.service

[Install]
WantedBy=timers.target
""",
        encoding="utf-8",
    )
    run(["systemctl", "daemon-reload"], timeout=30)
    run(["systemctl", "enable", SERVICE_NAME], timeout=30)
    run(["systemctl", "enable", f"{SERVICE_NAME}.timer"], timeout=30)
    print(f"已安装并 enable 服务: {SERVICE_PATH}")
    print(f"  脚本: {target_script}")
    print(f"  配置: {config_path}")
    print(f"  定时重试: {timer_path}")
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
    print(strip_ansi((show.stdout or show.stderr or "")).strip() or "(无输出)")

    cfg_path = resolve_config_path(args.config)
    devices = load_config(cfg_path)
    print(f"\n== 已保存设备 ({cfg_path}) ==")
    if not devices:
        print("（无）")
        return 0
    for d in devices:
        if not device_available(d.mac):
            print(f"  {d.mac}  {d.name or '-'}")
            print("    auto={}  not-in-cache  offline".format(d.auto_connect))
            continue
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
            # 允许直接 connect 未在配置中的 MAC
            targets = [DeviceRecord(mac=mac, name="", auto_connect=True)]

    # 连接前做一次轻量扫描，刷新 BlueZ 缓存（解决 Device not available）
    if not getattr(args, "no_scan", False):
        print("连接前刷新扫描（让 BlueZ 重新看到设备）…")
        scan_devices(min(getattr(args, "seconds", SCAN_SECONDS_DEFAULT), 12))

    ok_n = 0
    updated = False
    for d in targets:
        if not d.auto_connect and not args.force and args.mac is None:
            if not getattr(args, "quiet_ok", False):
                print(f"跳过（auto_connect=false）: {d.mac} {d.name}")
            continue
        if is_connected(d.mac):
            if not getattr(args, "quiet_ok", False):
                print(f"已连接: {d.mac} {d.name}")
            ok_n += 1
            continue

        # 身份键 = 配置中的 MAC；禁止按名称改绑到其它 ring
        ok, resolved_mac, new_name = pair_trust_connect(
            d.mac, d.name, allow_name_rediscover=False
        )
        if resolved_mac != d.mac:
            eprint(
                f"  拒绝改绑: 目标 MAC 必须为 {d.mac}，忽略 {resolved_mac}"
            )
            resolved_mac = d.mac
        if new_name and new_name != d.name:
            for item in devices:
                if item.mac == d.mac:
                    item.name = new_name
            updated = True
            print(f"  已更新显示名: {d.mac}  name={new_name!r}")
        if ok:
            ok_n += 1

    if updated:
        save_config(cfg_path, devices)

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
        # 交互选择得到的 mac 即为唯一身份；连接失败也不改成同名其它设备
        ok, mac2, name2 = pair_trust_connect(mac, name, allow_name_rediscover=False)
        if mac2 != mac:
            eprint(f"  拒绝改绑: 保持所选 MAC {mac}（忽略 {mac2}）")
            mac2 = mac
        if ok:
            success += 1
        rec = DeviceRecord(
            mac=mac2,
            name=name2 or name,
            trusted=True,
            auto_connect=True,
            paired_at=now,
        )
        saved = upsert_device(saved, rec)

    save_config(cfg_path, saved)
    print(f"\n连接成功 {success}/{len(selected)}")
    print("配置以 MAC 为唯一键保存；同名 ring 需分别选择各自 MAC。")

    if is_root() and which("systemctl"):
        if args.yes or prompt_yes_no("安装开机自动连接 systemd 服务？", default=True):
            install_service(cfg_path)
            run(["systemctl", "start", SERVICE_NAME], timeout=120)
    else:
        print(
            "\n提示: 使用 root 运行下列命令可安装开机自连服务：\n"
            f"  sudo python3 {Path(__file__).resolve()} install-service"
        )

    print(
        "\n完成。\n"
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
        epilog=(
            "默认无子命令时进入交互 setup。\n"
            "全局参数 --config/--seconds/-y 建议写在子命令前，例如:\n"
            "  bluetooth.py --config /etc/toydairy-bluetooth/devices.json connect\n"
            "子命令后也可写（兼容旧 unit）。"
        ),
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

    # 挂到每个子命令，允许: connect --config PATH
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", type=Path, default=None, help=argparse.SUPPRESS)
    common.add_argument("--seconds", type=int, default=None, help=argparse.SUPPRESS)
    common.add_argument("-y", "--yes", action="store_true", default=False, help=argparse.SUPPRESS)

    sub = p.add_subparsers(dest="command")

    def add_cmd(name: str, help_text: str):
        return sub.add_parser(name, help=help_text, parents=[common])

    sp = add_cmd("scan", "扫描并列出设备")
    sp.set_defaults(func=cmd_scan)

    sp = add_cmd("status", "适配器与已保存设备状态")
    sp.set_defaults(func=cmd_status)

    sp = add_cmd("list", "列出已保存配置")
    sp.set_defaults(func=cmd_list)

    sp = add_cmd("connect", "按配置重连（先扫描刷新缓存）")
    sp.add_argument("mac", nargs="?", help="只连接指定 MAC")
    sp.add_argument("--force", action="store_true", help="忽略 auto_connect=false")
    sp.add_argument("--no-scan", action="store_true", help="连接前不预扫描")
    sp.add_argument(
        "--quiet-ok",
        action="store_true",
        help="已连接时少打日志（供 systemd 使用）",
    )
    sp.set_defaults(func=cmd_connect)

    sp = add_cmd("remove", "取消配对并删除配置")
    sp.add_argument("mac", help="设备 MAC")
    sp.set_defaults(func=cmd_remove)

    sp = add_cmd("install-service", "安装开机自动连接服务")
    sp.set_defaults(func=cmd_install_service)

    sp = add_cmd("uninstall-service", "卸载开机自动连接服务")
    sp.set_defaults(func=cmd_uninstall_service)

    sp = add_cmd("setup", "交互扫描连接（默认）")
    sp.set_defaults(func=cmd_setup)

    sp = add_cmd("help", "显示说明")
    sp.set_defaults(func=cmd_help)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        args.command = "setup"
        args.func = cmd_setup
    # 子命令上的 --seconds=None 时回落到默认
    if getattr(args, "seconds", None) is None:
        args.seconds = SCAN_SECONDS_DEFAULT
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
