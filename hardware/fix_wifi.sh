#!/bin/bash

# ========================================================
# Armbian WiFi 开机自动连接 一键修复脚本
# 功能：清理旧配置冲突、接管NetworkManager、优化WiFi参数
# 使用方法：sudo bash fix_wifi.sh
# ========================================================

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Armbian WiFi 开机自动连接修复工具   ${NC}"
echo -e "${YELLOW}========================================${NC}"

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}[错误] 请使用 sudo 运行此脚本！${NC}"
  exit 1
fi

echo -e "\n${GREEN}[1/5] 清理旧的网络配置冲突...${NC}"

# 备份原始文件
if [ -f /etc/network/interfaces ]; then
    cp /etc/network/interfaces /etc/network/interfaces.bak.$(date +%s)
    echo "    - 已备份 /etc/network/interfaces"
    
    # 注释掉 wlan0 相关的旧配置
    if grep -q "wlan0" /etc/network/interfaces; then
        sed -i '/wlan0/ s/^/#/' /etc/network/interfaces
        echo "    - 已注释掉 interfaces 中的 wlan0 配置"
    fi
fi

if [ -f /etc/wpa_supplicant/wpa_supplicant.conf ]; then
    cp /etc/wpa_supplicant/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf.bak.$(date +%s)
    echo "    - 已备份 wpa_supplicant.conf"
fi

echo -e "\n${GREEN}[2/5] 禁用冲突的网络服务...${NC}"
# 停止并禁用旧的 wpa_supplicant (防止和 NM 抢网卡)
if systemctl is-active --quiet wpa_supplicant; then
    systemctl stop wpa_supplicant
    systemctl disable wpa_supplicant
    echo "    - 已禁用 wpa_supplicant 服务"
else
    echo "    - wpa_supplicant 服务未运行 (跳过)"
fi

echo -e "\n${GREEN}[3/5] 查找当前 WiFi 连接...${NC}"
# 获取当前 WiFi 连接名称
WIFI_NAME=$(nmcli -t -f NAME,TYPE connection show --active | grep "802-11-wireless" | cut -d':' -f1 | head -n 1)

if [ -z "$WIFI_NAME" ]; then
    # 如果没有活动的，找所有配置过的
    WIFI_NAME=$(nmcli -t -f NAME,TYPE connection show | grep "802-11-wireless" | cut -d':' -f1 | head -n 1)
fi

if [ -z "$WIFI_NAME" ]; then
    echo -e "${RED}[错误] 未找到任何 WiFi 连接配置！${NC}"
    echo -e "${YELLOW}[提示] 请先使用 'sudo nmtui' 手动连接一次 WiFi，然后再运行此脚本。${NC}"
    exit 1
fi

echo -e "    - 找到 WiFi 配置: ${GREEN}'$WIFI_NAME'${NC}"

echo -e "\n${GREEN}[4/5] 注入 NetworkManager 自动连接参数...${NC}"

# 核心修复：强制自动连接、重试机制、DHCP
nmcli connection modify "$WIFI_NAME" connection.autoconnect yes
nmcli connection modify "$WIFI_NAME" connection.autoconnect-priority 100
nmcli connection modify "$WIFI_NAME" connection.autoconnect-retries 5
nmcli connection modify "$WIFI_NAME" ipv4.method auto

echo "    - 已开启: 开机自动连接"
echo "    - 已设置: 最高连接优先级 (100)"
echo "    - 已设置: 失败重试 5 次"
echo "    - 已确认: 使用 DHCP 动态获取 IP"

echo -e "\n${GREEN}[5/5] 优化 WiFi 驱动参数 (防休眠/防MAC随机)...${NC}"

# 创建 NM 配置文件，解决 ARM 板子常见的省电断流和 MAC 随机化问题
cat > /etc/NetworkManager/conf.d/99-fix-wifi-stable.conf <<EOF
[connection]
wifi.powersave = 2
wifi.cloned-mac-address = preserve

[device]
wifi.scan-rand-mac-address = no
EOF

echo "    - 已禁用 WiFi 省电模式"
echo "    - 已禁用 MAC 地址随机化"

echo -e "\n${YELLOW}[应用配置] 正在重启 NetworkManager...${NC}"
systemctl restart NetworkManager

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  修复完成！正在进行最终验证...       ${NC}"
echo -e "${GREEN}========================================${NC}"

sleep 3
echo -e "\n当前网络状态："
nmcli connection show | grep "$WIFI_NAME"

echo -e "\n${YELLOW}[下一步操作建议]：${NC}"
echo "1. 请输入 'sudo reboot' 重启设备测试开机自动连接。"
echo "2. 如果重启后连不上，请检查路由器后台，建议绑定该设备的 MAC 地址以防 IP 变化。"
echo "3. 获取设备 MAC 地址命令: nmcli device show wlan0 | grep GENERAL.HWADDR"
