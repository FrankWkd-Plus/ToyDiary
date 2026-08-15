# talk2 / record2

板子侧的 Ring 常驻录音监听入口，运行目录对应 `/home/talk2/record2`。

## 它做什么

- 运行在已经连着戒指的板子上
- 启动时先扫描/连接戒指
- 之后常驻循环：等待戒指录音触发 → 接收自动上报的录音数据 → 解码为 WAV
- 每次录音都会**覆盖写入同一个固定文件** `/home/talk2/record2/result.wav`（先写临时文件再原子替换，避免读到半个文件）
- 若中途蓝牙断开，会自动重连并继续循环，不需要重启进程

跟 `hardware/talk2/record`（一次性、自动命名输出到 `ring/input`）的区别：这个入口是长期运行的服务，输出路径固定为 `result.wav`。

## 启动

```bash
cd /home/talk2/record2
python3 run.py
```

默认会优先连接固定设备 `E2:C5:D7:16:6E:EA`；如需覆盖，可显式传入 `--address`。

## 可选参数

```bash
python3 run.py --address <ble-mac-or-id>
python3 run.py --output result.wav       # 默认就是这个，相对路径相对脚本所在目录
python3 run.py --timeout 120             # 单次等待录音触发的超时；默认不设超时，一直等
python3 run.py --scan-timeout 25
python3 run.py --command-timeout 10
python3 run.py --auto-time-sync
```

## 需要手动同步到板子的内容

- `hardware/talk2/record2/` → `/home/talk2/record2/`
- `hardware/ring/ring_sound.py` → `/home/talk2/ring_sound.py` 或 `/home/talk2/ring/ring_sound.py`

这个入口不依赖 `hardware/talk`，只依赖 Ring SDK 本身（`bleak` + `ffmpeg`）。

## 依赖

板子上需要：

```bash
sudo apt install -y python3-bleak ffmpeg
```

## 输出

- 启动时的蓝牙扫描/连接日志
- 每次触发后的 `/home/talk2/record2/result.wav`（16kHz/16bit/mono PCM WAV，由戒指的 Speex 录音解码而来）
