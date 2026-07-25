# talk2 / play2 — 有线播放

板载 **Analog RK809（3.5mm）** 播放 wav，不走蓝牙。

## 用法

```bash
cd /home/talk2/play2
python3 wire_play.py --list          # 看声卡
python3 wire_play.py                 # 播 test.wav
python3 wire_play.py test.wav
python3 wire_play.py --volume 40 test.wav
python3 wire_play.py --device plughw:CARD=RK809,DEV=0 test.wav
```

## 给其它模块调用

```bash
# 推荐：子进程调用（tts.py 已采用此方式）
python3 /home/talk2/play2/wire_play.py /path/to/file.wav --volume 50
```

也可在 Python 里 `import wire_play; wire_play.play_file(...)`。  
`talk2/tts/tts.py` 使用 **子进程** 执行本脚本，与手动命令一致。

## 配置 `config.yaml`

```yaml
playback:
  device: "plughw:CARD=RK809,DEV=0"
  volume: 50
```

HDMI 输出可改为 `plughw:CARD=HDMI,DEV=0`。
