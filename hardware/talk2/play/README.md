# talk2 / play — 蓝牙音箱 wav 播放

独立于 `hardware/talk` 的干净实现，先验证 **A2DP 能正常播 .wav**。

## 文件

| 路径 | 说明 |
|------|------|
| `bt_play.py` | 播放入口 |
| `config.yaml` | MAC / 音量 / 采样率 |
| `test.wav` | 板子上的测试音频（从 `hardware/pi/test.wav` 同步） |
| `cache/` | 重采样缓存 |

## 板子用法

```bash
cd /home/talk2/play
python3 bt_play.py                  # 播 test.wav 或 config 默认
python3 bt_play.py test.wav
python3 bt_play.py --volume 35 test.wav
python3 bt_play.py --mac 52:5E:48:6A:8D:26 /path/to/x.wav
```

## 依赖

```bash
sudo apt install -y bluez bluez-alsa-utils alsa-utils ffmpeg python3-yaml
sudo systemctl enable --now bluealsa
# 音箱需已 pair/trust（可用 /home/blt/bluetooth.py）
```

## 配置要点 (`config.yaml`)

```yaml
bluetooth:
  mac: "52:5E:48:6A:8D:26"
playback:
  volume: 40          # 0-100
  sample_rate: 48000  # 与 bluealsa 协商一致
  channels: 2
  prefer: "aplay"     # 或 ffmpeg
```
