# hardware/record

板子侧的 Ring 录音监听入口，运行目录对应 `/home/talk2/record`。

## 它做什么

- 运行在已经连着戒指的板子上
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

## 依赖

这个入口直接依赖 `hardware/ring/ring_sound.py`，不依赖 `hardware/talk` 或 `hardware/talk2` 的其它模块。
只要板子能导入 Ring SDK，就能运行。

## 输出

程序会把录音保存为：

- 原始 `.bin`
- STT 用 `.wav`

默认输出目录是 `hardware/ring/input`。
