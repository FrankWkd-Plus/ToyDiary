#!/usr/bin/env python3
import sys
import os
import json
import wave
from vosk import Model, KaldiRecognizer

# ================= 配置区 =================
# 1. 你的 Vosk 模型解压后的绝对路径 (请根据实际情况修改)
MODEL_PATH = "/dev/shm/vosk-model-small-cn-0.22" 

# 2. 输出目录和文件
OUTPUT_DIR = "/home/talk2/stt"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "result.txt")
# ==========================================

def main():
    # 检查是否传入了音频文件参数
    if len(sys.argv) < 2:
        print("用法: python3 stt.py <你的音频文件.wav>")
        sys.exit(1)

    wav_file = sys.argv[1]

    # 检查音频文件是否存在
    if not os.path.exists(wav_file):
        print(f"错误: 找不到音频文件 '{wav_file}'")
        sys.exit(1)

    os.system(f"ffmpeg -i '{wav_file}' -ar 16000 -ac 1 -sample_fmt s16 fixed.wav")
    os.system(f"rm '{wav_file}'")
    os.system(f"mv fixed.wav '{wav_file}'")

    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 加载 Vosk 模型
    if not os.path.exists(MODEL_PATH):
        print(f"错误: 找不到模型目录 '{MODEL_PATH}'，请检查 MODEL_PATH 配置并确保已解压。")
        sys.exit(1)
        
    print(f"正在加载模型: {MODEL_PATH} ...")
    model = Model(MODEL_PATH)
    
    # 打开并检查 WAV 文件
    try:
        wf = wave.open(wav_file, "rb")
    except wave.Error:
        print("错误: 无法打开文件，请确保它是一个有效的 WAV 文件。")
        sys.exit(1)

    # Vosk 严格要求: 单声道 (1 channel), 16-bit (sampwidth 2), 16kHz (framerate 16000)
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        print("警告: 音频格式不是 16kHz/单声道/16bit！")
        print("识别结果可能会是乱码或完全为空。")
        print("建议先用 ffmpeg 转换: ffmpeg -i input.wav -ar 16000 -ac 1 -sample_fmt s16 output.wav")

    # 初始化识别器
    rec = KaldiRecognizer(model, wf.getframerate())

    results = []
    print("正在识别中...")
    
    # 读取音频帧并识别
    while True:
        data = wf.readframes(80000) # 每次读取 80000 帧
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            # 当检测到一句话结束时，获取结果
            res = json.loads(rec.Result())
            if res.get("text"):
                results.append(res["text"])

    # 获取最后一段未结束的句子
    final_res = json.loads(rec.FinalResult())
    if final_res.get("text"):
        results.append(final_res["text"])

    # 拼接结果
    full_text = "".join(results)

    #full_text = full_text.replace(" ","")

    # 写入文件
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(full_text)

    print(f"识别完成！")
    print(f"结果已保存到: {OUTPUT_FILE}")
    print(f"内容: {full_text}")

if __name__ == "__main__":
    main()
