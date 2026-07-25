# talk2 / record

板子侧的 Ring 录音监听入口，运行目录对应 `/home/talk2/record`。

## 它做什么

- 运行在已经连着戒指的板子上
- 启动时先检查戒指蓝牙连接性
- 等待戒指录音触发
- 接收设备自动上报的录音数据
- 导出 `wav` 到 `hardware/ring/input`

## 启动

```bash
cd /home/talk2/record
python3 run.py
```

## 可选参数

```bash
python3 run.py --address <ble-id>
python3 run.py --output ../ring/input
python3 run.py --timeout 120
python3 run.py --scan-timeout 25
python3 run.py --command-timeout 10
python3 run.py --auto-time-sync
```

## 需要手动同步到板子的内容

你需要把下面内容手动同步到板子上对应目录：

- `hardware/talk2/record/` → `/home/talk2/record/`
- `hardware/ring/ring_sound.py` → `/home/talk2/ring_sound.py` 或 `/home/talk2/ring/ring_sound.py`

这个入口不依赖 `hardware/talk`，只依赖 Ring SDK 本身。

## 输出

程序会把录音保存为：

- 启动时的蓝牙检测日志
- 原始 `.bin`
- STT 用 `.wav`

默认输出目录是 `hardware/ring/input`。
